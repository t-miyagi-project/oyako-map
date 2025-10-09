from django.db import connection, transaction
from rest_framework.permissions import IsAuthenticated
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
