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
