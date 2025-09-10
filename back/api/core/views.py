from django.db import connection
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
import base64
import json
import uuid


def _error_response(code: str, message: str, details: dict | None = None, status_code: int = 400):
    """API設計に合わせたエラーレスポンスを生成する。
    - code: エラー分類（例: VALIDATION_ERROR）
    - message: 人が読める説明
    - details: フィールド名などの詳細
    - status_code: HTTPステータス
    """
    trace_id = f"req_{uuid.uuid4().hex[:12]}"
    return Response(
        {
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
                "trace_id": trace_id,
            }
        },
        status=status_code,
    )

class PingView(APIView):
    def get(self, request):
        return Response({"pong": True})


class PlacesSearchView(APIView):
    """施設検索（距離順）。
    必須: lat, lng
    任意: radius_m(既定3000, 最大30000), limit(既定20, 最大50), cursor(base64), q, category
    仕様: PostGISのKNNで距離順に並べ、`{ items, next_cursor }` を返す。
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
            return _error_response(
                code="VALIDATION_ERROR",
                message=f"{str(e)} is required and must be a number",
                details={"field": str(e)},
                status_code=400,
            )

        # 緯度経度の範囲チェック
        if not (-90.0 <= lat <= 90.0):
            return _error_response(
                code="VALIDATION_ERROR", message="lat out of range", details={"field": "lat"}
            )
        if not (-180.0 <= lng <= 180.0):
            return _error_response(
                code="VALIDATION_ERROR", message="lng out of range", details={"field": "lng"}
            )

        # 半径・件数・ソート
        radius_m = qp.get("radius_m")
        try:
            radius_m = float(radius_m) if radius_m is not None else 3000.0
        except Exception:
            return _error_response(
                code="VALIDATION_ERROR", message="radius_m must be a number", details={"field": "radius_m"}
            )
        if radius_m <= 0 or radius_m > 30000:
            return _error_response(
                code="VALIDATION_ERROR", message="radius_m must be between 1 and 30000", details={"field": "radius_m"}
            )

        limit = qp.get("limit")
        try:
            limit = int(limit) if limit is not None else 20
        except Exception:
            return _error_response(
                code="VALIDATION_ERROR", message="limit must be an integer", details={"field": "limit"}
            )
        if limit <= 0 or limit > 50:
            return _error_response(
                code="VALIDATION_ERROR", message="limit must be between 1 and 50", details={"field": "limit"}
            )

        sort = qp.get("sort")
        if sort and sort != "distance":
            # 現時点では distance のみ対応
            return _error_response(
                code="VALIDATION_ERROR", message="sort supports only 'distance' currently", details={"field": "sort"}
            )

        # カーソル（オフセットベースの簡易実装）
        offset = _decode_cursor(qp.get("cursor"))

        # 任意フィルタ
        q = qp.get("q")
        category = qp.get("category")

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

        where_sql = " AND ".join(where)

        sql = f"""
        WITH up AS (
            SELECT ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography AS g
        )
        SELECT p.id, p.name,
               c.code AS category_code, c.label AS category_label,
               p.lat, p.lng,
               ST_Distance(p.geog, up.g) AS dist_m,
               COALESCE((
                 SELECT array_agg(f.code ORDER BY f.code)
                 FROM place_features pf
                 JOIN features f ON f.id = pf.feature_id
                 WHERE pf.place_id = p.id AND COALESCE(pf.value,1) > 0
               ), ARRAY[]::text[]) AS features_summary
        FROM places p
        JOIN categories c ON c.id = p.category_id
        CROSS JOIN up
        WHERE {where_sql}
        ORDER BY p.geog <-> up.g, p.id
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
                features_summary,
            ) = row
            items.append(
                {
                    "id": str(place_id),
                    "name": name,
                    "category": {"code": category_code, "label": category_label},
                    "location": {"lat": float(plat) if plat is not None else None, "lng": float(plng) if plng is not None else None, "distance_m": float(dist_m)},
                    "features_summary": features_summary or [],
                    # rating/thumbnail は将来拡張に備えてプレースホルダを用意（null/0）
                    "rating": {"overall": None, "count": 0},
                    "thumbnail_url": None,
                }
            )

        next_cursor = None
        if len(items) == limit:
            next_cursor_obj = {"offset": offset + limit}
            next_cursor = base64.urlsafe_b64encode(json.dumps(next_cursor_obj).encode("utf-8")).decode("utf-8")

        return Response({"items": items, "next_cursor": next_cursor})
