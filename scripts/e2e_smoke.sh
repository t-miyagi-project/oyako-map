#!/usr/bin/env bash
set -euo pipefail

# 最小E2Eスモークテスト（現在地 → 距離順一覧取得）
# - DB/API を docker compose で起動
# - Django マイグレーション適用
# - サンプルデータ投入（back/sql/demo_seed.sql）
# - /api/ping と /api/places を叩いて疎通＆件数確認

API_BASE="http://localhost:8000"

echo "[1/5] DB を起動（PostGIS）..."
docker compose up -d db

echo "[2/5] API を起動..."
docker compose up -d api

echo "[3/5] マイグレーション適用..."
docker compose run --rm api python manage.py migrate

echo "[4/5] サンプルデータ投入..."
docker compose exec -T db psql -U app -d app -v ON_ERROR_STOP=1 -f back/sql/demo_seed.sql

echo "[5/5] 疎通確認: /api/ping ..."
curl -fsS "${API_BASE}/api/ping/" | sed -e 's/.*/OK: ping 応答あり/' || (echo "NG: ping 失敗" && exit 1)

echo "検索: 東京駅付近 lat=35.6812 lng=139.7671 radius_m=3000 limit=5"
RESULT_JSON=$(curl -fsS "${API_BASE}/api/places?lat=35.6812&lng=139.7671&radius_m=3000&limit=5")

# jq があれば件数と先頭のみ整形表示
if command -v jq >/dev/null 2>&1; then
  COUNT=$(echo "$RESULT_JSON" | jq '.items | length')
  FIRST=$(echo "$RESULT_JSON" | jq -r '.items[0].name // empty')
  echo "件数: $COUNT"
  if [ -n "$FIRST" ]; then echo "先頭: $FIRST"; fi
else
  # jq が無ければそのまま一行だけ出力
  echo "$RESULT_JSON" | head -c 400 | tr -d '\n' && echo
fi

echo "E2Eスモーク: 完了（フロントでの表示は別途ブラウザで確認してください）"

