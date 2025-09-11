from django.db import migrations


SQL = r"""
-- place_stats（施設集計・一覧最適化）
CREATE TABLE IF NOT EXISTS place_stats (
  place_id        uuid PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
  avg_overall     numeric(3,2),
  review_count    int NOT NULL DEFAULT 0,
  photo_count     int NOT NULL DEFAULT 0,
  last_reviewed_at timestamptz
);
"""


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0003_seed_initial_data"),
    ]

    operations = [
        migrations.RunSQL(sql=SQL, reverse_sql=""),
    ]

