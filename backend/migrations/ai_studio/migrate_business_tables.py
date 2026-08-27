from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path
from typing import Any

import psycopg
from psycopg import sql

BACKEND_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND_DIR))

import database  # noqa: E402
from secret_crypto import decrypt_value  # noqa: E402

SOURCE_SCHEMA = "ai_lounge"
TARGET_SCHEMA = "ai_studio"
PORTAL_SCHEMA = "data_catalog"
LEGACY_USER_ID = "df851f0a-0617-4ad8-b55c-94cd7a66ea0e"
PORTAL_USER_ID = "33502"

TABLES = [
    "news",
    "ai_usage_posts",
    "ai_usage_post_likes",
    "ideas",
    "idea_attachments",
    "dx_discovery_sessions",
    "dx_discovery_messages",
    "ai_assets",
    "ai_asset_slides",
    "ai_asset_data_files",
    "ai_asset_skill_files",
    "ai_asset_bookmarks",
    "ai_asset_diffusion_attempts",
    "ai_asset_diffusion_cases",
    "ai_asset_qa_posts",
    "ai_asset_qa_helpful",
]

USER_COLUMNS = {
    "news": {"writer"},
    "ai_usage_posts": {"user_id"},
    "ai_usage_post_likes": {"user_id"},
    "ideas": {"user_id"},
    "dx_discovery_sessions": {"user_id"},
    "ai_assets": {"created_by", "reviewed_by"},
    "ai_asset_bookmarks": {"user_id"},
    "ai_asset_diffusion_attempts": {"user_id"},
    "ai_asset_diffusion_cases": {"user_id"},
    "ai_asset_qa_posts": {"user_id"},
    "ai_asset_qa_helpful": {"user_id"},
}

DEDUPLICATABLE_RELATION_TABLES = {
    "ai_usage_post_likes",
    "ai_asset_bookmarks",
    "ai_asset_diffusion_attempts",
    "ai_asset_qa_helpful",
}


def read_sql(name: str) -> str:
    return (Path(__file__).resolve().parent / name).read_text(encoding="utf-8")


def source_connection() -> psycopg.Connection[Any]:
    password = decrypt_value(database.DB_PASSWORD, database.DB_CRYPT_KEY)
    return psycopg.connect(
        host=database.DB_HOST,
        port=database.DB_PORT,
        dbname=database.DB_NAME,
        user=database.DB_USER,
        password=password,
    )


def target_connection(args: argparse.Namespace) -> psycopg.Connection[Any]:
    password = getpass.getpass("Portal DB password: ")
    return psycopg.connect(
        host=args.target_host,
        port=args.target_port,
        dbname=args.target_database,
        user=args.target_user,
        password=password,
    )


def table_columns(connection: psycopg.Connection[Any], schema: str, table: str) -> list[str]:
    rows = connection.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        ORDER BY ordinal_position
        """,
        (schema, table),
    ).fetchall()
    return [row[0] for row in rows]


def primary_key_columns(connection: psycopg.Connection[Any], schema: str, table: str) -> list[str]:
    rows = connection.execute(
        """
        SELECT a.attname
        FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
        JOIN unnest(c.conkey) WITH ORDINALITY AS keys(attnum, ord) ON TRUE
        JOIN pg_catalog.pg_attribute a ON a.attrelid = t.oid AND a.attnum = keys.attnum
        WHERE c.contype = 'p' AND n.nspname = %s AND t.relname = %s
        ORDER BY keys.ord
        """,
        (schema, table),
    ).fetchall()
    return [row[0] for row in rows]


def map_rows(table: str, columns: list[str], rows: list[tuple[Any, ...]]) -> list[tuple[Any, ...]]:
    user_indexes = [columns.index(column) for column in USER_COLUMNS.get(table, set()) if column in columns]
    mapped: list[tuple[Any, ...]] = []
    for row in rows:
        values = list(row)
        for index in user_indexes:
            if values[index] == LEGACY_USER_ID:
                values[index] = PORTAL_USER_ID
        mapped.append(tuple(values))
    return mapped


def resolve_mapped_pk_collisions(
    table: str,
    columns: list[str],
    pk_columns: list[str],
    rows: list[tuple[Any, ...]],
) -> list[tuple[Any, ...]]:
    indexes = [columns.index(column) for column in pk_columns]
    unique: dict[tuple[Any, ...], tuple[Any, ...]] = {}
    for row in rows:
        key = tuple(row[index] for index in indexes)
        unique.setdefault(key, row)
    duplicate_count = len(rows) - len(unique)
    if duplicate_count and table not in DEDUPLICATABLE_RELATION_TABLES:
        raise RuntimeError(f"User ID mapping creates a primary-key collision in {table}")
    if duplicate_count:
        print(f"MERGED {table}: {duplicate_count} duplicate relationship row(s)")
    return list(unique.values())


def verify_target_is_empty(connection: psycopg.Connection[Any]) -> None:
    existing = connection.execute(
        "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = %s ORDER BY tablename",
        (TARGET_SCHEMA,),
    ).fetchall()
    if existing:
        names = ", ".join(row[0] for row in existing)
        raise RuntimeError(f"Target schema already has tables: {names}")


def verify_portal_user(connection: psycopg.Connection[Any]) -> None:
    exists = connection.execute(
        sql.SQL("SELECT EXISTS (SELECT 1 FROM {}.tb_account WHERE user_id = %s)").format(
            sql.Identifier(PORTAL_SCHEMA)
        ),
        (PORTAL_USER_ID,),
    ).fetchone()[0]
    if not exists:
        raise RuntimeError(f"Portal account {PORTAL_USER_ID} does not exist")


def verify_user_ids(connection: psycopg.Connection[Any]) -> None:
    user_ids: set[str] = set()
    for table, columns in USER_COLUMNS.items():
        for column in columns:
            query = sql.SQL("SELECT DISTINCT {} FROM {}.{} WHERE {} IS NOT NULL").format(
                sql.Identifier(column),
                sql.Identifier(TARGET_SCHEMA),
                sql.Identifier(table),
                sql.Identifier(column),
            )
            user_ids.update(row[0] for row in connection.execute(query).fetchall())

    missing = []
    for user_id in sorted(user_ids):
        exists = connection.execute(
            sql.SQL("SELECT EXISTS (SELECT 1 FROM {}.tb_account WHERE user_id = %s)").format(
                sql.Identifier(PORTAL_SCHEMA)
            ),
            (user_id,),
        ).fetchone()[0]
        if not exists:
            missing.append(user_id)
    if missing:
        raise RuntimeError(f"User IDs missing from Portal: {', '.join(missing)}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target-host", default="10.65.109.95")
    parser.add_argument("--target-port", type=int, default=5432)
    parser.add_argument("--target-database", default="data_catalog")
    parser.add_argument("--target-user", default="data_catalog")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    with source_connection() as source, target_connection(args) as target:
        source.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        verify_target_is_empty(target)
        verify_portal_user(target)

        prepared: dict[str, tuple[list[str], list[tuple[Any, ...]]]] = {}
        for table in TABLES:
            columns = table_columns(source, SOURCE_SCHEMA, table)
            if not columns:
                raise RuntimeError(f"Source table is missing: {SOURCE_SCHEMA}.{table}")
            query = sql.SQL("SELECT {} FROM {}.{}").format(
                sql.SQL(", ").join(map(sql.Identifier, columns)),
                sql.Identifier(SOURCE_SCHEMA),
                sql.Identifier(table),
            )
            source_rows = source.execute(query).fetchall()
            rows = map_rows(table, columns, source_rows)
            rows = resolve_mapped_pk_collisions(
                table,
                columns,
                primary_key_columns(source, SOURCE_SCHEMA, table),
                rows,
            )
            prepared[table] = (columns, rows)
            print(f"PREPARED {table}: source={len(source_rows)}, target={len(rows)} rows")

        if not args.apply:
            target.rollback()
            print("Preflight passed. Re-run with --apply to migrate.")
            return

        try:
            target.execute(read_sql("001_business_schema.sql"), prepare=False)
            for table in TABLES:
                columns, rows = prepared[table]
                if rows:
                    insert = sql.SQL("INSERT INTO {}.{} ({}) VALUES ({})").format(
                        sql.Identifier(TARGET_SCHEMA),
                        sql.Identifier(table),
                        sql.SQL(", ").join(map(sql.Identifier, columns)),
                        sql.SQL(", ").join(sql.Placeholder() for _ in columns),
                    )
                    with target.cursor() as cursor:
                        cursor.executemany(insert, rows)
                target_count = target.execute(
                    sql.SQL("SELECT count(*) FROM {}.{}").format(
                        sql.Identifier(TARGET_SCHEMA), sql.Identifier(table)
                    )
                ).fetchone()[0]
                if target_count != len(rows):
                    raise RuntimeError(
                        f"Row count mismatch for {table}: source={len(rows)}, target={target_count}"
                    )
                print(f"COPIED {table}: {target_count} rows")

            verify_user_ids(target)
            target.execute(read_sql("002_triggers.sql"), prepare=False)
            target.commit()
        except Exception:
            target.rollback()
            raise

        print("Migration committed successfully.")


if __name__ == "__main__":
    main()
