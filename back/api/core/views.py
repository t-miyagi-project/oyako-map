from django.db import connection
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
import base64
import json
import uuid
from core.exceptions import error_response  # 共通エラーフォーマッタ


class PingView(APIView):
    def get(self, request):
        return Response({"pong": True})


class PlacesSearchView(APIView):
    """施設検索。
    必須: lat, lng
    任意: radius_m(既定3000, 最大30000), limit(既定20, 最大50), cursor(base64), q, category, sort
    並び替え(sort): distance | score | reviews | new
    仕様: 半径内で PostGIS KNN を使いつつ、指定の sort に応じて ORDER BY を切り替え、`{ items, next_cursor }` を返す。
    """

    def get(self, request):
        qp = request.query_params

        # 1) 入力の取得とバリデーション
        def _get_float(name: str, required: bool = False):
            v = qp.get(name)
            if v is None:
                if required:
                    raise ValueError(name)
                return None
            try:
                return float(v)
            except Exception:
                raise ValueError(name)

        def _decode_cursor(cur: str | None) -> int:
            """ベース64のcursorからoffsetを復元（無効時は0）。"""
            if not cur:
                return 0
            try:
                data = base64.urlsafe_b64decode(cur.encode("utf-8"))
                obj = json.loads(data.decode("utf-8"))
                # offsetベースの簡易カーソル
                return int(obj.get("offset", 0))
            except Exception:
                return 0

        try:
            lat = _get_float("lat", required=True)
            lng = _get_float("lng", required=True)
        except ValueError as e:
            # 必須パラメータが欠落/不正
            return error_response(
                code="VALIDATION_ERROR",
                message=f"{str(e)} is required and must be a number",
                details={"field": str(e)},
                status_code=400,
            )

        # 緯度経度の範囲チェック
        if not (-90.0 <= lat <= 90.0):
            return error_response(
                code="VALIDATION_ERROR", message="lat out of range", details={"field": "lat"}
            )
        if not (-180.0 <= lng <= 180.0):
            return error_response(
                code="VALIDATION_ERROR", message="lng out of range", details={"field": "lng"}
            )

        # 半径・件数・ソート
        radius_m = qp.get("radius_m")
        try:
            radius_m = float(radius_m) if radius_m is not None else 3000.0
        except Exception:
            return error_response(
                code="VALIDATION_ERROR", message="radius_m must be a number", details={"field": "radius_m"}
            )
        if radius_m <= 0 or radius_m > 30000:
            return error_response(
                code="VALIDATION_ERROR", message="radius_m must be between 1 and 30000", details={"field": "radius_m"}
            )

        limit = qp.get("limit")
        try:
            limit = int(limit) if limit is not None else 20
        except Exception:
            return error_response(
                code="VALIDATION_ERROR", message="limit must be an integer", details={"field": "limit"}
            )
        if limit <= 0 or limit > 50:
            return error_response(
                code="VALIDATION_ERROR", message="limit must be between 1 and 50", details={"field": "limit"}
            )

        sort = qp.get("sort") or "distance"
        if sort not in ("distance", "score", "reviews", "new"):
            return error_response(
                code="VALIDATION_ERROR",
                message="sort must be one of 'distance', 'score', 'reviews', 'new'",
                details={"field": "sort"},
            )

        # カーソル（オフセットベースの簡易実装）
        offset = _decode_cursor(qp.get("cursor"))

        # 任意フィルタ
        q = qp.get("q")
        category = qp.get("category")
        # features は複数指定に対応（features=... を複数回、features[] 形式にも両対応）。無効コードは無視する前提。
        features_list: list[str] = []
        try:
            # DRFの QueryDict は getlist を提供
            features_list = list(dict.fromkeys([*qp.getlist("features"), *qp.getlist("features[]")]))
        except Exception:
            features_list = []

        # 2) 検索SQLの構築（PostGIS KNN + 追加フィルタ）
        where = ["ST_DWithin(p.geog, up.g, %s)"]
        params = [
            float(lng),  # ST_MakePoint(X=lng, Y=lat)
            float(lat),
            float(radius_m),
        ]

        if category:
            where.append("c.code = %s")
            params.append(category)
        if q:
            where.append("p.search_vector @@ plainto_tsquery('simple', %s)")
            params.append(q)

        # features AND条件（指定された全コードを満たす施設に限定）
        for code in features_list:
            where.append(
                "EXISTS (SELECT 1 FROM place_features pf JOIN features f2 ON f2.id = pf.feature_id "
                "WHERE pf.place_id = p.id AND f2.code = %s AND COALESCE(pf.value,1) > 0)"
            )
            params.append(code)

        where_sql = " AND ".join(where)

        # 並び順の構築
        order_sql = "p.geog <-> up.g, p.id"
        if sort == "score":
            order_sql = "COALESCE(ps.avg_overall,0) DESC, p.geog <-> up.g, p.id"
        elif sort == "reviews":
            order_sql = "COALESCE(ps.review_count,0) DESC, p.geog <-> up.g, p.id"
        elif sort == "new":
            order_sql = "p.created_at DESC, p.geog <-> up.g, p.id"

        sql = f"""
        WITH up AS (
            SELECT ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography AS g
        )
        SELECT p.id, p.name,
               c.code AS category_code, c.label AS category_label,
               p.lat, p.lng,
               ST_Distance(p.geog, up.g) AS dist_m,
               ps.avg_overall, ps.review_count,
               p.created_at,
               COALESCE((
                 SELECT array_agg(f.code ORDER BY f.code)
                 FROM place_features pf
                 JOIN features f ON f.id = pf.feature_id
                 WHERE pf.place_id = p.id AND COALESCE(pf.value,1) > 0
               ), ARRAY[]::text[]) AS features_summary
        FROM places p
        JOIN categories c ON c.id = p.category_id
        LEFT JOIN place_stats ps ON ps.place_id = p.id
        CROSS JOIN up
        WHERE {where_sql}
        ORDER BY {order_sql}
        LIMIT %s OFFSET %s
        """

        params_with_page = [*params, int(limit), int(offset)]

        # 3) 実行と整形
        with connection.cursor() as cur:
            cur.execute(sql, params_with_page)
            rows = cur.fetchall()

        items = []
        for row in rows:
            (
                place_id,
                name,
                category_code,
                category_label,
                plat,
                plng,
                dist_m,
                avg_overall,
                review_count,
                created_at,
                features_summary,
            ) = row
            items.append(
                {
                    "id": str(place_id),
                    "name": name,
                    "category": {"code": category_code, "label": category_label},
                    "location": {"lat": float(plat) if plat is not None else None, "lng": float(plng) if plng is not None else None, "distance_m": float(dist_m)},
                    "features_summary": features_summary or [],
                    "rating": {"overall": float(avg_overall) if avg_overall is not None else None, "count": int(review_count or 0)},
                    "thumbnail_url": None,
                    "created_at": created_at,
                }
            )

        next_cursor = None
        if len(items) == limit:
            next_cursor_obj = {"offset": offset + limit}
            next_cursor = base64.urlsafe_b64encode(json.dumps(next_cursor_obj).encode("utf-8")).decode("utf-8")

        return Response({"items": items, "next_cursor": next_cursor})


class PlaceDetailView(APIView):
    """施設詳細を返す。
    入力: path param {id}
    返却: API設計に準拠した施設詳細（features/rating/photos/sourceメタを含む）。
    - 現状のDBにはレビュー/写真集計が無いため、rating と photos はプレースホルダ（overall=null, count=0, photos=[]）
    - 取得元メタは places.google_place_id / data_source を返す
    """

    def get(self, request, place_id: str):
        # 1) UUIDのバリデーション
        try:
            uuid.UUID(str(place_id))
        except Exception:
            return error_response(
                code="VALIDATION_ERROR",
                message="place_id must be a valid UUID",
                details={"field": "place_id"},
                status_code=400,
            )

        # 2) 施設本体の取得（カテゴリ含む）
        # 施設本体 + カテゴリ + place_stats（平均★/件数）を取得
        sql_place = """
            SELECT p.id, p.name, p.description, p.address, p.phone, p.website_url,
                   p.opening_hours_json, p.lat, p.lng,
                   c.code AS category_code, c.label AS category_label,
                   p.google_place_id, p.data_source,
                   ps.avg_overall, ps.review_count,
                   p.created_at, p.updated_at
            FROM places p
            JOIN categories c ON c.id = p.category_id
            LEFT JOIN place_stats ps ON ps.place_id = p.id
            WHERE p.id = %s
            LIMIT 1
        """

        # place_stats が未作成な環境でも動作するようフォールバックを用意
        sql_place_fallback = """
            SELECT p.id, p.name, p.description, p.address, p.phone, p.website_url,
                   p.opening_hours_json, p.lat, p.lng,
                   c.code AS category_code, c.label AS category_label,
                   p.google_place_id, p.data_source,
                   p.created_at, p.updated_at
            FROM places p
            JOIN categories c ON c.id = p.category_id
            WHERE p.id = %s
            LIMIT 1
        """

        try:
            with connection.cursor() as cur:
                cur.execute(sql_place, [str(place_id)])
                row = cur.fetchone()
            using_stats = True
        except Exception:
            with connection.cursor() as cur:
                cur.execute(sql_place_fallback, [str(place_id)])
                row = cur.fetchone()
            using_stats = False

        if not row:
            return error_response(
                code="NOT_FOUND", message="place not found", details={"place_id": str(place_id)}, status_code=404
            )

        if using_stats:
            (
                pid,
                name,
                description,
                address,
                phone,
                website_url,
                opening_hours_json,
                lat,
                lng,
                category_code,
                category_label,
                google_place_id,
                data_source,
                avg_overall,
                review_count,
                created_at,
                updated_at,
            ) = row
        else:
            (
                pid,
                name,
                description,
                address,
                phone,
                website_url,
                opening_hours_json,
                lat,
                lng,
                category_code,
                category_label,
                google_place_id,
                data_source,
                created_at,
                updated_at,
            ) = row
            avg_overall = None
            review_count = 0

        # 3) features（place_features×features）を取得
        sql_features = """
            SELECT f.code, f.label, COALESCE(pf.value, 1) AS value, pf.detail
            FROM place_features pf
            JOIN features f ON f.id = pf.feature_id
            WHERE pf.place_id = %s AND COALESCE(pf.value, 1) > 0
            ORDER BY f.code
        """
        with connection.cursor() as cur:
            cur.execute(sql_features, [str(place_id)])
            feature_rows = cur.fetchall()

        features = [
            {"code": code, "label": label, "value": int(value) if value is not None else None, "detail": detail}
            for (code, label, value, detail) in feature_rows
        ]

        # 4) rating/photos/sourceメタ
        # rating は place_stats の集計値を返す（無い場合は null/0）
        rating = {
            "overall": float(avg_overall) if avg_overall is not None else None,
            "count": int(review_count or 0),
            "axes": {},  # 軸別平均は将来拡張
        }

        # 写真（最新順）。storage_path をそのままURLとして返す（MEDIA連携は将来拡張）
        photos = []
        try:
            sql_photos = """
                SELECT storage_path, width, height, blurhash
                FROM photos
                WHERE place_id = %s
                ORDER BY created_at DESC
                LIMIT 20
            """
            with connection.cursor() as cur:
                cur.execute(sql_photos, [str(place_id)])
                photo_rows = cur.fetchall()
            photos = [
                {
                    "url": path,
                    "width": int(w) if w is not None else None,
                    "height": int(h) if h is not None else None,
                    "blurhash": bh,
                }
                for (path, w, h, bh) in photo_rows
            ]
        except Exception:
            photos = []

        # 取得元メタ（place_source_meta から最新を参照）
        google_meta = None
        if google_place_id:
            try:
                sql_meta = """
                    SELECT fetched_at
                    FROM place_source_meta
                    WHERE place_id = %s
                    ORDER BY fetched_at DESC
                    LIMIT 1
                """
                with connection.cursor() as cur:
                    cur.execute(sql_meta, [str(place_id)])
                    m = cur.fetchone()
                google_meta = {
                    "place_id": google_place_id,
                    "source": "google",
                    "synced_at": m[0] if m else None,
                }
            except Exception:
                google_meta = {"place_id": google_place_id, "source": "google", "synced_at": None}

        # 5) 応答を整形して返却
        return Response(
            {
                "id": str(pid),
                "name": name,
                "category": {"code": category_code, "label": category_label},
                "description": description,
                "address": address,
                "phone": phone,
                "website_url": website_url,
                "opening_hours": opening_hours_json,
                "location": {"lat": float(lat) if lat is not None else None, "lng": float(lng) if lng is not None else None},
                "features": features,
                "rating": rating,
                "photos": photos,
                "google": google_meta,
                "data_source": data_source,
                "created_at": created_at,
                "updated_at": updated_at,
            }
        )


class CategoriesListView(APIView):
    """カテゴリ一覧。
    返却: { items: [{ code, label, sort }] }
    """

    def get(self, request):
        sql = "SELECT code, label, sort FROM categories ORDER BY sort, code"
        with connection.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
        items = [{"code": code, "label": label, "sort": int(sort)} for (code, label, sort) in rows]
        return Response({"items": items})


class FeaturesListView(APIView):
    """設備・サービス一覧。
    返却: { items: [{ code, label, category, description }] }
    """

    def get(self, request):
        sql = "SELECT code, label, category, description FROM features ORDER BY code"
        with connection.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
        items = [
            {"code": code, "label": label, "category": category, "description": description}
            for (code, label, category, description) in rows
        ]
        return Response({"items": items})


class AgeBandsListView(APIView):
    """年齢帯一覧。
    返却: { items: [{ code, label, sort }] }
    """

    def get(self, request):
        sql = "SELECT id, code, label, sort FROM age_bands ORDER BY sort, code"
        with connection.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
        items = [{"id": str(id_), "code": code, "label": label, "sort": int(sort)} for (id_, code, label, sort) in rows]
        return Response({"items": items})
