import uuid

from django.db import migrations, models


SQL = r"""
-- age_bands
CREATE TABLE IF NOT EXISTS age_bands (
  id    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code  text UNIQUE NOT NULL,
  label text NOT NULL,
  sort  int NOT NULL DEFAULT 100
);

-- categories
CREATE TABLE IF NOT EXISTS categories (
  id    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code  text UNIQUE NOT NULL,
  label text NOT NULL,
  sort  int NOT NULL DEFAULT 100
);

-- features
CREATE TABLE IF NOT EXISTS features (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        text UNIQUE NOT NULL,
  label       text NOT NULL,
  category    text,
  description text
);

-- places（PostGIS geography, 生成列 lat/lng, tsvector 検索）
CREATE TABLE IF NOT EXISTS places (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  kana        text,
  category_id uuid NOT NULL REFERENCES categories(id),
  description text,
  address     text,
  phone       text,
  website_url text,
  price_range text,
  opening_hours_json jsonb,
  geog        geography(Point,4326) NOT NULL,
  lat         double precision GENERATED ALWAYS AS (ST_Y(geog::geometry)) STORED,
  lng         double precision GENERATED ALWAYS AS (ST_X(geog::geometry)) STORED,
  google_place_id text UNIQUE,
  data_source data_source NOT NULL DEFAULT 'google',
  manual_lock boolean NOT NULL DEFAULT false,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name,'')),'A') ||
    setweight(to_tsvector('simple', coalesce(description,'')),'B') ||
    setweight(to_tsvector('simple', coalesce(address,'')),'C')
  ) STORED,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_places_category ON places (category_id);
CREATE INDEX IF NOT EXISTS idx_places_geog ON places USING GIST (geog);
CREATE INDEX IF NOT EXISTS idx_places_search ON places USING GIN (search_vector);
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_places_updated_at'
  ) THEN
    CREATE TRIGGER trg_places_updated_at BEFORE UPDATE ON places FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- place_features（複合PK, CASCADE）
CREATE TABLE IF NOT EXISTS place_features (
  place_id   uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  value      smallint,
  detail     text,
  PRIMARY KEY (place_id, feature_id)
);
"""


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0001_enable_extensions"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(sql=SQL, reverse_sql=""),
            ],
            state_operations=[
                migrations.CreateModel(
                    name="AgeBand",
                    fields=[
                        ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                        ("code", models.CharField(max_length=100, unique=True)),
                        ("label", models.CharField(max_length=100)),
                        ("sort", models.IntegerField(default=100)),
                    ],
                    options={
                        "db_table": "age_bands",
                        "managed": False,
                    },
                ),
                migrations.CreateModel(
                    name="Category",
                    fields=[
                        ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                        ("code", models.CharField(max_length=100, unique=True)),
                        ("label", models.CharField(max_length=100)),
                        ("sort", models.IntegerField(default=100)),
                    ],
                    options={
                        "db_table": "categories",
                        "managed": False,
                    },
                ),
                migrations.CreateModel(
                    name="Feature",
                    fields=[
                        ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                        ("code", models.CharField(max_length=100, unique=True)),
                        ("label", models.CharField(max_length=100)),
                        ("category", models.CharField(blank=True, max_length=100, null=True)),
                        ("description", models.TextField(blank=True, null=True)),
                    ],
                    options={
                        "db_table": "features",
                        "managed": False,
                    },
                ),
            ],
        ),
    ]
