from django.conf import settings
from django.db import models
from uuid import uuid4


class AgeBand(models.Model):
    """年齢帯マスタ。
    - 例: 0-1歳, 2-3歳, 4-6歳
    """
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    code = models.CharField(max_length=100, unique=True)  # 一意なコード
    label = models.CharField(max_length=100)  # 表示ラベル
    sort = models.IntegerField(default=100)  # 並び順

    class Meta:
        db_table = "age_bands"
        managed = False

    def __str__(self) -> str:  # 表示用
        return f"{self.label}({self.code})"


class Category(models.Model):
    """施設カテゴリ。
    - 例: park, indoor_kids, restaurant
    """
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    code = models.CharField(max_length=100, unique=True)
    label = models.CharField(max_length=100)
    sort = models.IntegerField(default=100)

    class Meta:
        db_table = "categories"
        managed = False

    def __str__(self) -> str:
        return f"{self.label}({self.code})"


class Feature(models.Model):
    """設備・サービスのマスタ（UI上の「サービス」）。
    - 例: diaper_table, nursing_room, kids_toilet, stroller_ok
    """
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    code = models.CharField(max_length=100, unique=True)
    label = models.CharField(max_length=100)
    category = models.CharField(max_length=100, blank=True, null=True)  # カテゴリ（restroom/access/food等）
    description = models.TextField(blank=True, null=True)  # 補足説明

    class Meta:
        db_table = "features"
        managed = False

    def __str__(self) -> str:
        return f"{self.label}({self.code})"


class Place(models.Model):
    """施設。GeoDjango未使用のため geog/lat/lng はDB側生成に依存。
    - このモデルは既存テーブルに紐づくため managed=False とする。
    - 書き込み時は地理情報を含むSQLを別途実行してください（APIレイヤーで対応）。
    """
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    name = models.TextField()
    kana = models.TextField(blank=True, null=True)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, db_column="category_id")
    description = models.TextField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    phone = models.TextField(blank=True, null=True)
    website_url = models.TextField(blank=True, null=True)
    price_range = models.TextField(blank=True, null=True)
    opening_hours_json = models.JSONField(blank=True, null=True)
    # geog は DB 側に geography(Point,4326) として存在（ORMでは未マッピング）
    lat = models.FloatField()  # 生成列（DB側で算出）
    lng = models.FloatField()  # 生成列（DB側で算出）
    google_place_id = models.TextField(blank=True, null=True)
    data_source = models.TextField(default="google")
    manual_lock = models.BooleanField(default=False)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        db_table = "places"
        managed = False  # 既存テーブル（Raw SQLで作成）

    def __str__(self) -> str:
        return self.name


class UserProfile(models.Model):
    """ユーザーの拡張プロフィール情報。
    - ニックネーム、居住エリア、子どもの年齢帯など任意項目を保持する
    """
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    nickname = models.CharField(max_length=150, blank=True, null=True)
    home_area = models.CharField(max_length=150, blank=True, null=True)
    child_age_band = models.ForeignKey(AgeBand, on_delete=models.SET_NULL, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_profiles"

    def __str__(self) -> str:
        return f"Profile({self.user_id})"


class ReviewAxis(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    code = models.CharField(max_length=100, unique=True)
    label = models.CharField(max_length=100)
    sort = models.IntegerField(default=100)

    class Meta:
        db_table = "review_axes"

    def __str__(self) -> str:
        return f"{self.label}({self.code})"


class Review(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    place = models.ForeignKey(Place, on_delete=models.CASCADE, db_column="place_id")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, db_column="user_id")
    overall = models.PositiveSmallIntegerField()
    age_band = models.ForeignKey(AgeBand, on_delete=models.SET_NULL, blank=True, null=True, db_column="age_band_id")
    stay_minutes = models.PositiveIntegerField(blank=True, null=True)
    revisit_intent = models.PositiveSmallIntegerField(blank=True, null=True)
    text = models.TextField()
    status = models.CharField(max_length=16, default="public")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "reviews"
        indexes = [
            models.Index(fields=["place", "created_at"], name="idx_reviews_place_created"),
        ]

    def __str__(self) -> str:
        return f"Review({self.id})"


class ReviewScore(models.Model):
    id = models.BigAutoField(primary_key=True)
    review = models.ForeignKey(Review, on_delete=models.CASCADE, db_column="review_id", related_name="scores")
    axis = models.ForeignKey(ReviewAxis, on_delete=models.CASCADE, db_column="axis_id")
    score = models.PositiveSmallIntegerField()

    class Meta:
        db_table = "review_scores"
        unique_together = ("review", "axis")

    def __str__(self) -> str:
        return f"Score({self.review_id}, {self.axis_id})"


class Photo(models.Model):
    PURPOSE_REVIEW = "review_photo"
    PURPOSE_PLACE = "place_photo"
    PURPOSE_CHOICES = (
        (PURPOSE_REVIEW, "Review Photo"),
        (PURPOSE_PLACE, "Place Photo"),
    )

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    place = models.ForeignKey(Place, on_delete=models.CASCADE, blank=True, null=True, db_column="place_id", related_name="photos")
    review = models.ForeignKey(Review, on_delete=models.CASCADE, blank=True, null=True, db_column="review_id", related_name="photos")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="uploaded_photos")
    purpose = models.CharField(max_length=32, choices=PURPOSE_CHOICES)
    storage_path = models.TextField()
    mime_type = models.CharField(max_length=64, blank=True, null=True)
    width = models.IntegerField(blank=True, null=True)
    height = models.IntegerField(blank=True, null=True)
    file_size = models.BigIntegerField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "photos"
        indexes = [
            models.Index(fields=["place", "created_at"], name="idx_photos_place"),
            models.Index(fields=["review", "created_at"], name="idx_photos_review"),
        ]

    def __str__(self) -> str:
        return f"Photo({self.id})"
