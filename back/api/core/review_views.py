import base64
import json
import uuid

from django.db import connection, transaction
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.exceptions import error_response
from core.models import Place, Review, ReviewAxis, ReviewScore, Photo
from core.serializers import ReviewCreateSerializer


def refresh_place_stats(place_id: str):
    sql = """
        INSERT INTO place_stats (place_id, avg_overall, review_count, photo_count, last_reviewed_at)
        SELECT
            %(place_id)s,
            stats.avg_overall,
            stats.review_count,
            stats.photo_count,
            stats.last_reviewed_at
        FROM (
            SELECT
                AVG(r.overall)::numeric(3,2) AS avg_overall,
                COUNT(*) AS review_count,
                COALESCE(MAX(r.created_at), NOW()) AS last_reviewed_at,
                (
                    SELECT COUNT(*)
                    FROM photos p
                    WHERE (p.place_id = %(place_id)s OR p.review_id IN (SELECT id FROM reviews WHERE place_id = %(place_id)s))
                ) AS photo_count
            FROM reviews r
            WHERE r.place_id = %(place_id)s AND r.status = 'public'
        ) AS stats
        ON CONFLICT (place_id) DO UPDATE
        SET avg_overall = EXCLUDED.avg_overall,
            review_count = EXCLUDED.review_count,
            photo_count = EXCLUDED.photo_count,
            last_reviewed_at = EXCLUDED.last_reviewed_at
    """
    with connection.cursor() as cur:
        cur.execute(sql, {"place_id": str(place_id)})


class ReviewCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ReviewCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="入力内容に誤りがあります",
                details=serializer.errors,
            )

        data = serializer.validated_data
        place_id = data["place_id"]
        try:
            place = Place.objects.get(pk=place_id)
        except Place.DoesNotExist:
            return error_response(
                code="NOT_FOUND",
                message="指定された施設が見つかりません",
                details={"place_id": str(place_id)},
                status_code=404,
            )
        axes_payload = data["axes"]

        axis_map = {axis.code: axis for axis in ReviewAxis.objects.filter(code__in=[item["code"] for item in axes_payload])}

        missing_axes = [item["code"] for item in axes_payload if item["code"] not in axis_map]
        if missing_axes:
            return error_response(
                code="VALIDATION_ERROR",
                message="指定された評価軸が存在しません",
                details={"axes": missing_axes},
            )

        with transaction.atomic():
            photo_ids = data.get("photo_ids") or []
            photos = []
            if photo_ids:
                unique_ids = list({pid for pid in photo_ids})
                photos = list(
                    Photo.objects.select_for_update().filter(
                        id__in=unique_ids,
                        uploaded_by=request.user,
                        review__isnull=True,
                        purpose=Photo.PURPOSE_REVIEW,
                    )
                )
                if len(photos) != len(unique_ids):
                    return error_response(
                        code="VALIDATION_ERROR",
                        message="指定された写真が存在しないか、権限がありません",
                        details={"photo_ids": [str(pid) for pid in unique_ids]},
                    )
            review = Review.objects.create(
                place=place,
                user=request.user,
                overall=data["overall"],
                age_band=data.get("age_band_id"),
                stay_minutes=data.get("stay_minutes"),
                revisit_intent=data.get("revisit_intent"),
                text=data["text"],
                status="public",
            )
            ReviewScore.objects.bulk_create(
                [
                    ReviewScore(review=review, axis=axis_map[item["code"]], score=item["score"])
                    for item in axes_payload
                ]
            )
            if photos:
                for photo in photos:
                    photo.review = review
                    photo.place = place
                Photo.objects.bulk_update(photos, ["review", "place"])
            refresh_place_stats(place_id)

        return Response({"review_id": str(review.id)}, status=201)


AXIS_LABEL_MAP = {
    "cleanliness": "清潔さ",
    "safety": "安全",
    "noise": "騒音",
    "staff": "スタッフ対応",
    "crowd": "混雑",
}


def _serialize_review(request, review: Review) -> dict:
    profile = getattr(review.user, "profile", None)
    nickname = profile.nickname if profile and profile.nickname else review.user.email
    child_age = profile.child_age_band.label if profile and profile.child_age_band else None
    axes = {
        AXIS_LABEL_MAP.get(score.axis.code, score.axis.label): score.score
        for score in review.scores.all()
    }
    photos = []
    for photo in review.photos.all():
        try:
            url = request.build_absolute_uri(photo.storage_path)
        except Exception:
            url = photo.storage_path
        photos.append(
            {
                "id": str(photo.id),
                "url": url,
                "width": photo.width,
                "height": photo.height,
                "mime_type": photo.mime_type,
            }
        )
    return {
        "id": str(review.id),
        "overall": review.overall,
        "text": review.text,
        "stay_minutes": review.stay_minutes,
        "revisit_intent": review.revisit_intent,
        "created_at": review.created_at.isoformat(),
        "user": {
            "id": str(review.user.id),
            "nickname": nickname,
            "child_age_band": child_age,
        },
        "age_band": review.age_band.label if review.age_band else None,
        "axes": axes,
        "photos": photos,
    }


class ReviewListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, place_id: str):
        try:
            uuid.UUID(str(place_id))
        except Exception:
            return error_response(
                code="VALIDATION_ERROR",
                message="place_id must be a valid UUID",
                details={"field": "place_id"},
            )

        limit_param = request.query_params.get("limit", "5")
        try:
            limit = max(1, min(int(limit_param), 20))
        except ValueError:
            return error_response(
                code="VALIDATION_ERROR",
                message="limit must be an integer",
                details={"field": "limit"},
            )

        cursor = request.query_params.get("cursor")

        def decode_cursor(value: str | None) -> int:
            if not value:
                return 0
            try:
                payload = base64.urlsafe_b64decode(value.encode("utf-8"))
                obj = json.loads(payload.decode("utf-8"))
                return int(obj.get("offset", 0))
            except Exception:
                return 0

        offset = decode_cursor(cursor)

        sort = request.query_params.get("sort", "new")
        has_photo = request.query_params.get("has_photo")

        qs = (
            Review.objects.filter(place_id=place_id, status="public")
            .select_related("user", "user__profile", "age_band")
            .prefetch_related("scores__axis", "photos")
        )
        if has_photo in {"1", "true", "True", "yes"}:
            qs = qs.filter(photos__isnull=False).distinct()

        if sort == "rating":
            qs = qs.order_by("-overall", "-created_at")
        else:
            qs = qs.order_by("-created_at")

        reviews = list(qs[offset : offset + limit + 1])
        next_cursor = None
        if len(reviews) > limit:
            next_offset = offset + limit
            cursor_payload = base64.urlsafe_b64encode(json.dumps({"offset": next_offset}).encode("utf-8"))
            next_cursor = cursor_payload.decode("utf-8")
            reviews = reviews[:limit]

        items = [_serialize_review(request, review) for review in reviews]
        return Response({"items": items, "next_cursor": next_cursor})
