from django.db import migrations


EXTENSIONS_SQL = r"""
-- Extensions（存在しない場合のみ作成）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

-- ENUM Types（重複時はスキップ）
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('member','moderator','admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE review_status AS ENUM ('public','pending','hidden'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE report_status AS ENUM ('open','resolved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE data_source AS ENUM ('google','manual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sync_status AS ENUM ('queued','running','succeeded','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE suggestion_status AS ENUM ('pending','approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- updated_at トリガ関数（再作成）
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;
"""


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.RunSQL(sql=EXTENSIONS_SQL, reverse_sql=""),
    ]

