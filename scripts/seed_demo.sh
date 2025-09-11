#!/usr/bin/env bash
set -euo pipefail

# サンプル施設データの投入スクリプト（T-109）
# - 前提: docker compose で db/api サービスを使用
# - 用途: ローカル開発やE2E前の下準備として、サンプル施設を 10 件前後投入
# - 冪等: 同名の施設が存在する場合はスキップ（ON CONFLICT / NOT EXISTS を利用）

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)

echo "[seed] Postgres (db) へサンプル施設データを投入します..."
docker compose -f "$ROOT_DIR/back/docker-compose.yml" exec -T db \
  psql -U app -d app -v ON_ERROR_STOP=1 -f back/sql/demo_seed.sql

echo "[seed] 完了: back/sql/demo_seed.sql を適用しました。"

