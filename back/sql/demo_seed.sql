-- 動作確認用のサンプルデータ投入SQL（東京駅周辺3km圏内）
-- 前提: T-001/T-002/T-003（拡張/DDL/Seed）が適用済み
-- 目的: /api/places が距離順で結果を返すか確認するための最低限の施設データを作成

BEGIN;

-- 1) 日比谷公園（サンプル）: 公園
INSERT INTO places (id, name, category_id, description, address, geog, created_at, updated_at)
SELECT uuid_generate_v4(), '日比谷公園（サンプル）', c.id,
       '都心の大きな公園。ベビーカーでの移動可。',
       '東京都千代田区日比谷公園',
       ST_SetSRID(ST_MakePoint(139.7566, 35.6731), 4326)::geography,
       NOW(), NOW()
FROM categories c
WHERE c.code = 'park'
  AND NOT EXISTS (SELECT 1 FROM places p WHERE p.name = '日比谷公園（サンプル）');

-- 日比谷公園のサービス紐づけ
INSERT INTO place_features (place_id, feature_id, value, detail)
SELECT p.id, f.id, 1,
       CASE f.code
         WHEN 'stroller_ok' THEN '園内通路はベビーカーで移動可'
         WHEN 'kids_toilet' THEN '園内トイレに子ども向け設備あり'
       END
FROM places p
JOIN features f ON f.code IN ('stroller_ok','kids_toilet')
WHERE p.name = '日比谷公園（サンプル）'
ON CONFLICT (place_id, feature_id) DO NOTHING;

-- 2) 皇居外苑（サンプル）: 公園
INSERT INTO places (id, name, category_id, description, address, geog, created_at, updated_at)
SELECT uuid_generate_v4(), '皇居外苑（サンプル）', c.id,
       '広い外苑。散策向け。ベビーカーでの移動可。',
       '東京都千代田区皇居外苑',
       ST_SetSRID(ST_MakePoint(139.7601, 35.6795), 4326)::geography,
       NOW(), NOW()
FROM categories c
WHERE c.code = 'park'
  AND NOT EXISTS (SELECT 1 FROM places p WHERE p.name = '皇居外苑（サンプル）');

INSERT INTO place_features (place_id, feature_id, value, detail)
SELECT p.id, f.id, 1,
       CASE f.code
         WHEN 'stroller_ok' THEN 'フラットな舗装が多い'
       END
FROM places p
JOIN features f ON f.code IN ('stroller_ok')
WHERE p.name = '皇居外苑（サンプル）'
ON CONFLICT (place_id, feature_id) DO NOTHING;

-- 3) 東京ファミリーキッズランド（サンプル）: 屋内キッズ
INSERT INTO places (id, name, category_id, description, address, geog, created_at, updated_at)
SELECT uuid_generate_v4(), '東京ファミリーキッズランド（サンプル）', c.id,
       '屋内の遊び場。休憩スペースと授乳室あり。',
       '東京都千代田区丸の内',
       ST_SetSRID(ST_MakePoint(139.7665, 35.6845), 4326)::geography,
       NOW(), NOW()
FROM categories c
WHERE c.code = 'indoor_kids'
  AND NOT EXISTS (SELECT 1 FROM places p WHERE p.name = '東京ファミリーキッズランド（サンプル）');

INSERT INTO place_features (place_id, feature_id, value, detail)
SELECT p.id, f.id, 1,
       CASE f.code
         WHEN 'nursing_room' THEN '個室1・給湯あり'
         WHEN 'diaper_table' THEN '交換台2台'
         WHEN 'kids_toilet' THEN '小児用便座あり'
         WHEN 'elevator' THEN 'ベビーカー対応のエレベーター'
         WHEN 'stroller_ok' THEN 'ベビーカーでの入場可'
       END
FROM places p
JOIN features f ON f.code IN ('nursing_room','diaper_table','kids_toilet','elevator','stroller_ok')
WHERE p.name = '東京ファミリーキッズランド（サンプル）'
ON CONFLICT (place_id, feature_id) DO NOTHING;

-- 4) ファミリーカフェ こもれび（サンプル）: 飲食店
INSERT INTO places (id, name, category_id, description, address, geog, created_at, updated_at)
SELECT uuid_generate_v4(), 'ファミリーカフェ こもれび（サンプル）', c.id,
       '子連れ歓迎のカフェ。キッズメニューあり。',
       '東京都中央区八重洲',
       ST_SetSRID(ST_MakePoint(139.7715, 35.6790), 4326)::geography,
       NOW(), NOW()
FROM categories c
WHERE c.code = 'restaurant'
  AND NOT EXISTS (SELECT 1 FROM places p WHERE p.name = 'ファミリーカフェ こもれび（サンプル）');

INSERT INTO place_features (place_id, feature_id, value, detail)
SELECT p.id, f.id, 1,
       CASE f.code
         WHEN 'kids_menu' THEN '取り分けしやすい小鉢セット'
         WHEN 'allergy_label' THEN '主要アレルゲン表示あり'
         WHEN 'diaper_table' THEN '店内トイレに交換台あり'
       END
FROM places p
JOIN features f ON f.code IN ('kids_menu','allergy_label','diaper_table')
WHERE p.name = 'ファミリーカフェ こもれび（サンプル）'
ON CONFLICT (place_id, feature_id) DO NOTHING;

-- 5) ベビーカーOK広場 八重洲（サンプル）: 公園
INSERT INTO places (id, name, category_id, description, address, geog, created_at, updated_at)
SELECT uuid_generate_v4(), 'ベビーカーOK広場 八重洲（サンプル）', c.id,
       '小さな広場。ベビーカーでの通行に配慮。',
       '東京都中央区八重洲',
       ST_SetSRID(ST_MakePoint(139.7681, 35.6806), 4326)::geography,
       NOW(), NOW()
FROM categories c
WHERE c.code = 'park'
  AND NOT EXISTS (SELECT 1 FROM places p WHERE p.name = 'ベビーカーOK広場 八重洲（サンプル）');

INSERT INTO place_features (place_id, feature_id, value, detail)
SELECT p.id, f.id, 1, '通路幅広め'
FROM places p
JOIN features f ON f.code IN ('stroller_ok')
WHERE p.name = 'ベビーカーOK広場 八重洲（サンプル）'
ON CONFLICT (place_id, feature_id) DO NOTHING;

-- 6) キッズパーク 日本橋（サンプル）: 屋内キッズ
INSERT INTO places (id, name, category_id, description, address, geog, created_at, updated_at)
SELECT uuid_generate_v4(), 'キッズパーク 日本橋（サンプル）', c.id,
       '小規模な屋内プレイスペース。授乳室・交換台あり。',
       '東京都中央区日本橋',
       ST_SetSRID(ST_MakePoint(139.7747, 35.6830), 4326)::geography,
       NOW(), NOW()
FROM categories c
WHERE c.code = 'indoor_kids'
  AND NOT EXISTS (SELECT 1 FROM places p WHERE p.name = 'キッズパーク 日本橋（サンプル）');

INSERT INTO place_features (place_id, feature_id, value, detail)
SELECT p.id, f.id, 1,
       CASE f.code
         WHEN 'nursing_room' THEN '個室1'
         WHEN 'diaper_table' THEN '交換台1台'
         WHEN 'elevator' THEN '段差解消ルートあり'
       END
FROM places p
JOIN features f ON f.code IN ('nursing_room','diaper_table','elevator')
WHERE p.name = 'キッズパーク 日本橋（サンプル）'
ON CONFLICT (place_id, feature_id) DO NOTHING;

-- 7) 東京国際フォーラム キッズスペース（サンプル）: 屋内キッズ
INSERT INTO places (id, name, category_id, description, address, geog, created_at, updated_at)
SELECT uuid_generate_v4(), '東京国際フォーラム キッズスペース（サンプル）', c.id,
       '館内の一角にキッズスペース。エレベーター完備。',
       '東京都千代田区丸の内',
       ST_SetSRID(ST_MakePoint(139.7638, 35.6751), 4326)::geography,
       NOW(), NOW()
FROM categories c
WHERE c.code = 'indoor_kids'
  AND NOT EXISTS (SELECT 1 FROM places p WHERE p.name = '東京国際フォーラム キッズスペース（サンプル）');

INSERT INTO place_features (place_id, feature_id, value, detail)
SELECT p.id, f.id, 1,
       CASE f.code
         WHEN 'elevator' THEN '館内エレベーター多数'
         WHEN 'stroller_ok' THEN '館内はベビーカーで移動可'
         WHEN 'kids_toilet' THEN '案内板に子ども向けトイレ表示'
       END
FROM places p
JOIN features f ON f.code IN ('elevator','stroller_ok','kids_toilet')
WHERE p.name = '東京国際フォーラム キッズスペース（サンプル）'
ON CONFLICT (place_id, feature_id) DO NOTHING;

COMMIT;

