from __future__ import annotations

import base64
import hashlib
import hmac
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "app.db"
PBKDF2_ITERATIONS = 210_000

app = FastAPI(title="AI Lounge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:9001",
        "http://127.0.0.1:9001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginRequest(BaseModel):
    login_id: str
    password: str


class UserResponse(BaseModel):
    user_id: str
    login_id: str
    org_name: str
    displayed_name: str
    job_title: str
    is_admin: bool
    created_at: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UserCreateRequest(BaseModel):
    login_id: str = Field(min_length=1)
    org_name: str = Field(min_length=1)
    displayed_name: str = Field(min_length=1)
    job_title: str = Field(min_length=1)
    password: str = Field(min_length=1)
    is_admin: bool = False


class UserUpdateRequest(BaseModel):
    login_id: str = Field(min_length=1)
    org_name: str = Field(min_length=1)
    displayed_name: str = Field(min_length=1)
    job_title: str = Field(min_length=1)
    password: str | None = None
    is_admin: bool = False


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_connection() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init_db() -> None:
    with get_connection() as con:
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS user (
                user_id TEXT PRIMARY KEY,
                login_id TEXT NOT NULL UNIQUE,
                org_name TEXT NOT NULL,
                displayed_name TEXT NOT NULL,
                job_title TEXT NOT NULL,
                password TEXT NOT NULL,
                is_admin INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
            """
        )
        columns = {row[1] for row in con.execute("PRAGMA table_info(user)")}
        if "login_id" not in columns:
            con.execute("ALTER TABLE user ADD COLUMN login_id TEXT")
            con.execute("UPDATE user SET login_id = user_id WHERE login_id IS NULL OR login_id = ''")
        if "is_admin" not in columns:
            con.execute("ALTER TABLE user ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
        con.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_user_login_id ON user(login_id)")
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS user_sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
            )
            """
        )


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        PBKDF2_ITERATIONS,
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt, digest = password_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        expected = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            base64.b64decode(salt),
            int(iterations),
        )
        return hmac.compare_digest(expected, base64.b64decode(digest))
    except (ValueError, TypeError):
        return False


def user_from_row(row: sqlite3.Row) -> UserResponse:
    return UserResponse(
        user_id=row["user_id"],
        login_id=row["login_id"],
        org_name=row["org_name"],
        displayed_name=row["displayed_name"],
        job_title=row["job_title"],
        is_admin=bool(row["is_admin"]),
        created_at=row["created_at"],
    )


def create_session(user_id: str) -> str:
    token = uuid.uuid4().hex + uuid.uuid4().hex
    with get_connection() as con:
        con.execute(
            "INSERT INTO user_sessions (token, user_id, created_at) VALUES (?, ?, ?)",
            (token, user_id, utc_now()),
        )
    return token


def get_current_user(authorization: Annotated[str | None, Header()] = None) -> UserResponse:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="인증이 필요합니다.")

    token = authorization.split(" ", 1)[1].strip()
    with get_connection() as con:
        row = con.execute(
            """
            SELECT u.user_id, u.login_id, u.org_name, u.displayed_name, u.job_title, u.is_admin, u.created_at
            FROM user_sessions s
            JOIN user u ON u.user_id = s.user_id
            WHERE s.token = ?
            """,
            (token,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 세션입니다.")
    return user_from_row(row)


def require_admin(current_user: Annotated[UserResponse, Depends(get_current_user)]) -> UserResponse:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="관리자 권한이 필요합니다.")
    return current_user


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    with get_connection() as con:
        row = con.execute(
            """
            SELECT user_id, login_id, org_name, displayed_name, job_title, password, is_admin, created_at
            FROM user
            WHERE login_id = ?
            """,
            (payload.login_id,),
        ).fetchone()

    if row is None or not verify_password(payload.password, row["password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="사번 또는 비밀번호가 올바르지 않습니다.")

    return LoginResponse(access_token=create_session(row["user_id"]), user=user_from_row(row))


@app.get("/api/auth/me", response_model=UserResponse)
def me(current_user: Annotated[UserResponse, Depends(get_current_user)]) -> UserResponse:
    return current_user


@app.get("/api/admin/users", response_model=list[UserResponse])
def list_users(_: Annotated[UserResponse, Depends(require_admin)]) -> list[UserResponse]:
    with get_connection() as con:
        rows = con.execute(
            """
            SELECT user_id, login_id, org_name, displayed_name, job_title, is_admin, created_at
            FROM user
            WHERE is_admin = 0
            ORDER BY
                org_name COLLATE NOCASE ASC,
                CASE job_title
                    WHEN '전무' THEN 1
                    WHEN '상무' THEN 2
                    WHEN '실장' THEN 3
                    WHEN '팀장' THEN 4
                    WHEN '책임매니저' THEN 5
                    WHEN '매니저' THEN 6
                    ELSE 99
                END ASC,
                displayed_name COLLATE NOCASE ASC
            """
        ).fetchall()
    return [user_from_row(row) for row in rows]


@app.post("/api/admin/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreateRequest, _: Annotated[UserResponse, Depends(require_admin)]) -> UserResponse:
    user_id = str(uuid.uuid4())
    try:
        with get_connection() as con:
            con.execute(
                """
                INSERT INTO user (user_id, login_id, org_name, displayed_name, job_title, password, is_admin, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    payload.login_id.strip(),
                    payload.org_name.strip(),
                    payload.displayed_name.strip(),
                    payload.job_title.strip(),
                    hash_password(payload.password),
                    1 if payload.is_admin else 0,
                    utc_now(),
                ),
            )
            row = con.execute(
                """
                SELECT user_id, login_id, org_name, displayed_name, job_title, is_admin, created_at
                FROM user
                WHERE user_id = ?
                """,
                (user_id,),
            ).fetchone()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 사용 중인 사번입니다.")

    return user_from_row(row)


@app.put("/api/admin/users/{user_id}", response_model=UserResponse)
def update_user(user_id: str, payload: UserUpdateRequest, _: Annotated[UserResponse, Depends(require_admin)]) -> UserResponse:
    values: list[object] = [
        payload.login_id.strip(),
        payload.org_name.strip(),
        payload.displayed_name.strip(),
        payload.job_title.strip(),
        1 if payload.is_admin else 0,
    ]
    password_sql = ""
    if payload.password:
        password_sql = ", password = ?"
        values.append(hash_password(payload.password))
    values.append(user_id)

    try:
        with get_connection() as con:
            result = con.execute(
                f"""
                UPDATE user
                SET login_id = ?, org_name = ?, displayed_name = ?, job_title = ?, is_admin = ?{password_sql}
                WHERE user_id = ?
                """,
                values,
            )
            if result.rowcount == 0:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="계정을 찾을 수 없습니다.")
            row = con.execute(
                """
                SELECT user_id, login_id, org_name, displayed_name, job_title, is_admin, created_at
                FROM user
                WHERE user_id = ?
                """,
                (user_id,),
            ).fetchone()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 사용 중인 사번입니다.")

    return user_from_row(row)


@app.delete("/api/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, current_user: Annotated[UserResponse, Depends(require_admin)]) -> None:
    if user_id == current_user.user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="현재 로그인한 관리자 계정은 삭제할 수 없습니다.")

    with get_connection() as con:
        result = con.execute("DELETE FROM user WHERE user_id = ?", (user_id,))
        if result.rowcount == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="계정을 찾을 수 없습니다.")
