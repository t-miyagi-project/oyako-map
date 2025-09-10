from django.db import migrations


SEED_SQL = r"""
-- 初期データ投入（冪等）。存在する場合はスキップします。

-- 年齢帯（age_bands）
INSERT INTO age_bands (code, label, sort) VALUES
  ('baby_0_1','0-1歳',10),
  ('toddler_2_3','2-3歳',20),
  ('preschool_4_6','4-6歳',30)
ON CONFLICT (code) DO NOTHING;

-- カテゴリ（categories）
INSERT INTO categories (code, label, sort) VALUES
  ('park','公園',10),
  ('indoor_kids','屋内キッズ',20),
  ('restaurant','飲食店',30)
ON CONFLICT (code) DO NOTHING;

-- サービス（features）
INSERT INTO features (code, label, category) VALUES
  ('diaper_table','おむつ交換台','restroom'),
  ('nursing_room','授乳室','restroom'),
  ('kids_toilet','キッズトイレ','restroom'),
  ('stroller_ok','ベビーカーOK','access'),
  ('elevator','エレベーター','access'),
  ('kids_menu','キッズメニュー','food'),
  ('allergy_label','アレルギー表示','food')
ON CONFLICT (code) DO NOTHING;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0002_create_base_tables"),
    ]

    operations = [
        # Raw SQLでSeedを投入。ON CONFLICTで冪等にする。
        migrations.RunSQL(sql=SEED_SQL, reverse_sql=""),
    ]

