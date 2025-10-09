from django.db import connection, transaction
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.exceptions import error_response
from core.models import Place, Review, ReviewAxis, ReviewScore
from core.serializers import ReviewCreateSerializer


def refresh_place_stats(place_id: str):
    sql = """
        INSERT INTO place_stats (place_id, avg_overall, review_count, photo_count, last_reviewed_at)
        SELECT
            r.place_id,
            AVG(r.overall)::numeric(3,2) AS avg_overall,
            COUNT(*) AS review_count,
            COALESCE(ps.photo_count, 0) AS photo_count,
            MAX(r.created_at) AS last_reviewed_at
        FROM reviews r
        LEFT JOIN place_stats ps ON ps.place_id = r.place_id
        WHERE r.place_id = %s AND r.status = 'public'
        GROUP BY r.place_id, ps.photo_count
        ON CONFLICT (place_id) DO UPDATE
        SET avg_overall = EXCLUDED.avg_overall,
            review_count = EXCLUDED.review_count,
            photo_count = EXCLUDED.photo_count,
            last_reviewed_at = EXCLUDED.last_reviewed_at
    """
    with connection.cursor() as cur:
        cur.execute(sql, [str(place_id)])


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
            refresh_place_stats(place_id)

        return Response({"review_id": str(review.id)}, status=201)
