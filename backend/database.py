from __future__ import annotations

import os
import re
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from pathlib import Path
from threading import Lock
from typing import Any

from dotenv import load_dotenv
from psycopg import Connection, Cursor, IntegrityError
from psycopg.rows import RowMaker
from psycopg_pool import ConnectionPool

from secret_crypto import decrypt_value

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "data_catalog")
DB_USER = os.getenv("DB_USER", "data_catalog")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_CRYPT_KEY = os.getenv("DB_CRYPT_KEY")
DB_SCHEMA = os.getenv("DB_SCHEMA", "ai_lounge")
DB_POOL_MIN_SIZE = int(os.getenv("DB_POOL_MIN_SIZE", "1"))
DB_POOL_MAX_SIZE = int(os.getenv("DB_POOL_MAX_SIZE", "3"))
DB_POOL_TIMEOUT_SECONDS = float(os.getenv("DB_POOL_TIMEOUT_SECONDS", "10"))

if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", DB_SCHEMA):
    raise RuntimeError("DB_SCHEMA must be a valid PostgreSQL identifier")
if DB_POOL_MIN_SIZE < 0 or DB_POOL_MAX_SIZE < 1:
    raise RuntimeError("Database pool sizes must be positive")
if DB_POOL_MIN_SIZE > DB_POOL_MAX_SIZE:
    raise RuntimeError("DB_POOL_MIN_SIZE cannot exceed DB_POOL_MAX_SIZE")


class DatabaseRow(Sequence[Any]):
    def __init__(self, columns: tuple[str, ...], values: Sequence[Any]):
        self._columns = columns
        self._values = tuple(values)
        self._index = {name: index for index, name in enumerate(columns)}

    def __getitem__(self, key: int | slice | str) -> Any:
        if isinstance(key, str):
            return self._values[self._index[key]]
        return self._values[key]

    def __iter__(self) -> Iterator[Any]:
        return iter(self._values)

    def __len__(self) -> int:
        return len(self._values)

    def keys(self) -> tuple[str, ...]:
        return self._columns


def database_row_factory(cursor: Cursor[Any]) -> RowMaker[DatabaseRow]:
    columns = tuple(column.name for column in (cursor.description or ()))
    return lambda values: DatabaseRow(columns, values)


def _translate_query(query: str) -> str:
    translated = query.replace("?", "%s")
    translated = re.sub(
        r"\b(FROM|JOIN|INTO|UPDATE)\s+user\b",
        r'\1 "user"',
        translated,
        flags=re.IGNORECASE,
    )
    translated = re.sub(
        r"\bDELETE\s+FROM\s+user\b", 'DELETE FROM "user"', translated, flags=re.IGNORECASE
    )
    if re.match(r"^\s*INSERT\s+OR\s+IGNORE\s+INTO\b", translated, re.IGNORECASE):
        translated = re.sub(
            r"^\s*INSERT\s+OR\s+IGNORE\s+INTO\b",
            "INSERT INTO",
            translated,
            count=1,
            flags=re.IGNORECASE,
        )
        translated = translated.rstrip().removesuffix(";") + " ON CONFLICT DO NOTHING"
    return translated


class DatabaseConnection:
    def __init__(self, connection: Connection[DatabaseRow]):
        self._connection = connection

    def execute(self, query: str, params: Sequence[Any] | None = None) -> Cursor[DatabaseRow]:
        return self._connection.execute(_translate_query(query), params)

    def executemany(self, query: str, params_seq: Sequence[Sequence[Any]]) -> Cursor[DatabaseRow]:
        cursor = self._connection.cursor()
        cursor.executemany(_translate_query(query), params_seq)
        return cursor


_pool_lock = Lock()
_pool: ConnectionPool[DatabaseRow] | None = None


def _build_pool() -> ConnectionPool[DatabaseRow]:
    if not DB_PASSWORD:
        raise RuntimeError("DB_PASSWORD must be provided through the environment or backend/.env")
    resolved_password = decrypt_value(DB_PASSWORD, DB_CRYPT_KEY)
    return ConnectionPool(
        kwargs={
            "host": DB_HOST,
            "port": DB_PORT,
            "dbname": DB_NAME,
            "user": DB_USER,
            "password": resolved_password,
            "options": f"-c search_path={DB_SCHEMA},public",
            "row_factory": database_row_factory,
        },
        min_size=DB_POOL_MIN_SIZE,
        max_size=DB_POOL_MAX_SIZE,
        timeout=DB_POOL_TIMEOUT_SECONDS,
        check=ConnectionPool.check_connection,
        open=False,
    )


def open_database_pool() -> None:
    global _pool
    with _pool_lock:
        if _pool is None:
            _pool = _build_pool()
            _pool.open(wait=True)


def close_database_pool() -> None:
    global _pool
    with _pool_lock:
        if _pool is not None:
            _pool.close()
            _pool = None


@contextmanager
def get_connection() -> Iterator[DatabaseConnection]:
    open_database_pool()
    assert _pool is not None
    with _pool.connection() as connection:
        yield DatabaseConnection(connection)
