from __future__ import annotations

import base64
import hashlib
import hmac
import os
import re
import shutil
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from llm_client import chat_completion


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "app.db"
NEWS_WORKSPACE = BASE_DIR / "workspace" / "tech_news"
USAGE_POSTS_WORKSPACE = BASE_DIR / "workspace" / "usage_posts"
IDEAS_WORKSPACE = BASE_DIR / "workspace" / "ideas"
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


class NewsResponse(BaseModel):
    news_id: str
    title: str
    writer: str
    writer_name: str | None = None
    cover_image: str | None = None
    cover_image_url: str | None = None
    view_count: int = 0
    created_at: str
    updated_at: str


class NewsDetailResponse(NewsResponse):
    markdown: str


class NewsDraftRequest(BaseModel):
    source: str = Field(min_length=1)


class NewsDraftResponse(BaseModel):
    markdown: str


class AiUsagePostCreateRequest(BaseModel):
    title: str = Field(min_length=1)
    category: str = Field(min_length=1)
    content_html: str = Field(min_length=1)


class AiUsagePostResponse(BaseModel):
    usage_post_id: str
    title: str
    category: str
    user_id: str
    author_name: str | None = None
    author_org: str | None = None
    author_job_title: str | None = None
    content_text: str
    view_count: int = 0
    like_count: int = 0
    liked_by_me: bool = False
    created_at: str
    updated_at: str


class AiUsagePostDetailResponse(AiUsagePostResponse):
    content_html: str


class IdeaAttachmentResponse(BaseModel):
    attachment_id: str
    original_name: str
    stored_name: str
    size: int
    content_type: str | None = None
    url: str


class IdeaStatusUpdateRequest(BaseModel):
    status: str = Field(min_length=1)
    review_comment: str = Field(min_length=1)


class IdeaResponse(BaseModel):
    idea_id: str
    title: str
    problem_definition: str
    proposal: str
    effect: str
    user_id: str
    author_name: str | None = None
    author_org: str | None = None
    author_job_title: str | None = None
    status: str
    attachment_count: int = 0
    attachments: list[IdeaAttachmentResponse] = Field(default_factory=list)
    created_at: str
    updated_at: str
    reviewed_at: str | None = None
    review_comment: str | None = None


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
                password TEXT NOT NULL,
                org_name TEXT NOT NULL,
                job_title TEXT NOT NULL,
                displayed_name TEXT NOT NULL,
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
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS news (
                news_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                writer TEXT NOT NULL,
                cover_image TEXT,
                view_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (writer) REFERENCES user(user_id) ON DELETE RESTRICT
            )
            """
        )
        news_columns = {row[1] for row in con.execute("PRAGMA table_info(news)")}
        if "cover_image" not in news_columns:
            con.execute("ALTER TABLE news ADD COLUMN cover_image TEXT")
        if "view_count" not in news_columns:
            con.execute("ALTER TABLE news ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0")
        con.execute("CREATE INDEX IF NOT EXISTS idx_news_created_at ON news(created_at)")
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_usage_posts (
                usage_post_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                user_id TEXT NOT NULL,
                content_text TEXT NOT NULL DEFAULT '',
                view_count INTEGER NOT NULL DEFAULT 0,
                like_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE RESTRICT
            )
            """
        )
        usage_columns = {row[1] for row in con.execute("PRAGMA table_info(ai_usage_posts)")}
        if "content_text" not in usage_columns:
            con.execute("ALTER TABLE ai_usage_posts ADD COLUMN content_text TEXT NOT NULL DEFAULT ''")
        if "view_count" not in usage_columns:
            con.execute("ALTER TABLE ai_usage_posts ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0")
        if "like_count" not in usage_columns:
            con.execute("ALTER TABLE ai_usage_posts ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0")
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_usage_post_likes (
                usage_post_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (usage_post_id, user_id),
                FOREIGN KEY (usage_post_id) REFERENCES ai_usage_posts(usage_post_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
            )
            """
        )
        con.execute("CREATE INDEX IF NOT EXISTS idx_ai_usage_posts_created_at ON ai_usage_posts(created_at)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_ai_usage_posts_like_count ON ai_usage_posts(like_count)")
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS ideas (
                idea_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                problem_definition TEXT NOT NULL,
                proposal TEXT NOT NULL,
                effect TEXT NOT NULL,
                user_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT '접수완료',
                attachment_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                reviewed_at TEXT,
                review_comment TEXT,
                FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE RESTRICT
            )
            """
        )
        idea_columns = {row[1] for row in con.execute("PRAGMA table_info(ideas)")}
        if "effect" not in idea_columns and "expected_effect" in idea_columns:
            con.execute("ALTER TABLE ideas RENAME COLUMN expected_effect TO effect")
        if "attachment_count" not in idea_columns:
            con.execute("ALTER TABLE ideas ADD COLUMN attachment_count INTEGER NOT NULL DEFAULT 0")
        if "updated_at" not in idea_columns:
            con.execute("ALTER TABLE ideas ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''")
            con.execute("UPDATE ideas SET updated_at = created_at WHERE updated_at = ''")
        if "review_comment" not in idea_columns:
            con.execute("ALTER TABLE ideas ADD COLUMN review_comment TEXT")
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS idea_attachments (
                attachment_id TEXT PRIMARY KEY,
                idea_id TEXT NOT NULL,
                original_name TEXT NOT NULL,
                stored_name TEXT NOT NULL,
                size INTEGER NOT NULL,
                content_type TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (idea_id) REFERENCES ideas(idea_id) ON DELETE CASCADE
            )
            """
        )
        con.execute("CREATE INDEX IF NOT EXISTS idx_ideas_user_created_at ON ideas(user_id, created_at)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_idea_attachments_idea_id ON idea_attachments(idea_id)")
        NEWS_WORKSPACE.mkdir(parents=True, exist_ok=True)
        USAGE_POSTS_WORKSPACE.mkdir(parents=True, exist_ok=True)
        IDEAS_WORKSPACE.mkdir(parents=True, exist_ok=True)


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


def news_cover_url(news_id: str, cover_image: str | None) -> str | None:
    if not cover_image:
        return None
    return f"/api/news/{news_id}/cover"


def news_from_row(row: sqlite3.Row) -> NewsResponse:
    return NewsResponse(
        news_id=row["news_id"],
        title=row["title"],
        writer=row["writer"],
        writer_name=row["writer_name"] if "writer_name" in row.keys() else None,
        cover_image=row["cover_image"],
        cover_image_url=news_cover_url(row["news_id"], row["cover_image"]),
        view_count=row["view_count"] if "view_count" in row.keys() else 0,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def news_dir(news_id: str) -> Path:
    return NEWS_WORKSPACE / news_id


def markdown_path(news_id: str) -> Path:
    return news_dir(news_id) / "content.md"


def usage_post_dir(usage_post_id: str) -> Path:
    return USAGE_POSTS_WORKSPACE / usage_post_id


def usage_post_content_path(usage_post_id: str) -> Path:
    return usage_post_dir(usage_post_id) / "content.html"


def usage_post_assets_dir(usage_post_id: str) -> Path:
    return usage_post_dir(usage_post_id) / "assets"


def idea_dir(idea_id: str) -> Path:
    return IDEAS_WORKSPACE / idea_id


def idea_attachments_dir(idea_id: str) -> Path:
    return idea_dir(idea_id) / "attachments"


def text_from_html(content_html: str) -> str:
    text_only = re.sub(r"<[^>]+>", " ", content_html)
    return re.sub(r"\s+", " ", text_only).strip()


def normalize_usage_post_content(usage_post_id: str, content_html: str) -> str:
    assets_dir = usage_post_assets_dir(usage_post_id)
    assets_dir.mkdir(parents=True, exist_ok=True)
    pattern = re.compile(r"src=(?P<quote>[\"'])data:(?P<mime>image/(?:png|jpeg|jpg|gif|webp));base64,(?P<data>[^\"']+)(?P=quote)", re.IGNORECASE)
    ext_by_mime = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/gif": ".gif",
        "image/webp": ".webp",
    }

    def replace_match(match: re.Match[str]) -> str:
        mime = match.group("mime").lower()
        suffix = ext_by_mime.get(mime, ".img")
        filename = f"{uuid.uuid4().hex}{suffix}"
        try:
            image_bytes = base64.b64decode(match.group("data"), validate=True)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="본문 이미지 데이터를 읽을 수 없습니다.")
        if len(image_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="본문 이미지는 10MB 이하만 사용할 수 있습니다.")
        (assets_dir / filename).write_bytes(image_bytes)
        return f'src="/api/usage-posts/{usage_post_id}/assets/{filename}"'

    return pattern.sub(replace_match, content_html)


def ai_usage_post_from_row(row: sqlite3.Row) -> AiUsagePostResponse:
    return AiUsagePostResponse(
        usage_post_id=row["usage_post_id"],
        title=row["title"],
        category=row["category"],
        user_id=row["user_id"],
        author_name=row["author_name"] if "author_name" in row.keys() else None,
        author_org=row["author_org"] if "author_org" in row.keys() else None,
        author_job_title=row["author_job_title"] if "author_job_title" in row.keys() else None,
        content_text=row["content_text"],
        view_count=row["view_count"],
        like_count=row["like_count"],
        liked_by_me=bool(row["liked_by_me"]) if "liked_by_me" in row.keys() else False,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def idea_attachment_url(idea_id: str, attachment_id: str) -> str:
    return f"/api/ideas/{idea_id}/attachments/{attachment_id}"


def idea_attachment_from_row(row: sqlite3.Row) -> IdeaAttachmentResponse:
    return IdeaAttachmentResponse(
        attachment_id=row["attachment_id"],
        original_name=row["original_name"],
        stored_name=row["stored_name"],
        size=row["size"],
        content_type=row["content_type"],
        url=idea_attachment_url(row["idea_id"], row["attachment_id"]),
    )


def idea_from_row(row: sqlite3.Row, attachments: list[IdeaAttachmentResponse] | None = None) -> IdeaResponse:
    return IdeaResponse(
        idea_id=row["idea_id"],
        title=row["title"],
        problem_definition=row["problem_definition"],
        proposal=row["proposal"],
        effect=row["effect"],
        user_id=row["user_id"],
        author_name=row["author_name"] if "author_name" in row.keys() else None,
        author_org=row["author_org"] if "author_org" in row.keys() else None,
        author_job_title=row["author_job_title"] if "author_job_title" in row.keys() else None,
        status=row["status"],
        attachment_count=row["attachment_count"],
        attachments=attachments or [],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        reviewed_at=row["reviewed_at"],
        review_comment=row["review_comment"] if "review_comment" in row.keys() else None,
    )


def safe_attachment_filename(original_name: str) -> str:
    suffix = Path(original_name).suffix.lower()
    if not suffix or len(suffix) > 20:
        suffix = ".file"
    return f"{uuid.uuid4().hex}{suffix}"


def save_cover_image(news_id: str, cover_image: UploadFile | None) -> str | None:
    if cover_image is None or not cover_image.filename:
        return None
    if cover_image.content_type and not cover_image.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="커버 이미지는 이미지 파일만 업로드할 수 있습니다.")

    suffix = Path(cover_image.filename).suffix.lower() or ".image"
    filename = f"cover{suffix}"
    target = news_dir(news_id) / filename
    with target.open("wb") as out_file:
        shutil.copyfileobj(cover_image.file, out_file)
    return filename


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


def fetch_idea_attachments(con: sqlite3.Connection, idea_id: str) -> list[IdeaAttachmentResponse]:
    rows = con.execute(
        """
        SELECT attachment_id, idea_id, original_name, stored_name, size, content_type, created_at
        FROM idea_attachments
        WHERE idea_id = ?
        ORDER BY created_at, original_name
        """,
        (idea_id,),
    ).fetchall()
    return [idea_attachment_from_row(row) for row in rows]


@app.get("/api/admin/ideas", response_model=list[IdeaResponse])
def list_admin_ideas(_: Annotated[UserResponse, Depends(require_admin)]) -> list[IdeaResponse]:
    with get_connection() as con:
        rows = con.execute(
            """
            SELECT
                i.idea_id,
                i.title,
                i.problem_definition,
                i.proposal,
                i.effect,
                i.user_id,
                u.displayed_name AS author_name,
                u.org_name AS author_org,
                u.job_title AS author_job_title,
                i.status,
                i.attachment_count,
                i.created_at,
                i.updated_at,
                i.reviewed_at,
                i.review_comment
            FROM ideas i
            LEFT JOIN user u ON u.user_id = i.user_id
            ORDER BY i.created_at DESC
            """
        ).fetchall()
        return [idea_from_row(row, fetch_idea_attachments(con, row["idea_id"])) for row in rows]


@app.put("/api/admin/ideas/{idea_id}/status", response_model=IdeaResponse)
def update_admin_idea_status(
    idea_id: str,
    payload: IdeaStatusUpdateRequest,
    _: Annotated[UserResponse, Depends(require_admin)],
) -> IdeaResponse:
    clean_status = payload.status.strip()
    clean_comment = payload.review_comment.strip()
    if clean_status not in {"선정", "미선정"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="올바른 심사 상태를 선택하세요.")
    if not clean_comment:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="심사 의견을 입력하세요.")
    now = utc_now()
    reviewed_at = now
    with get_connection() as con:
        result = con.execute(
            """
            UPDATE ideas
            SET status = ?, updated_at = ?, reviewed_at = ?, review_comment = ?
            WHERE idea_id = ?
            """,
            (clean_status, now, reviewed_at, clean_comment, idea_id),
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="아이디어를 찾을 수 없습니다.")
        row = con.execute(
            """
            SELECT
                i.idea_id,
                i.title,
                i.problem_definition,
                i.proposal,
                i.effect,
                i.user_id,
                u.displayed_name AS author_name,
                u.org_name AS author_org,
                u.job_title AS author_job_title,
                i.status,
                i.attachment_count,
                i.created_at,
                i.updated_at,
                i.reviewed_at,
                i.review_comment
            FROM ideas i
            LEFT JOIN user u ON u.user_id = i.user_id
            WHERE i.idea_id = ?
            """,
            (idea_id,),
        ).fetchone()
        return idea_from_row(row, fetch_idea_attachments(con, idea_id))


@app.get("/api/ideas", response_model=list[IdeaResponse])
def list_ideas(current_user: Annotated[UserResponse, Depends(get_current_user)]) -> list[IdeaResponse]:
    with get_connection() as con:
        rows = con.execute(
            """
            SELECT
                i.idea_id,
                i.title,
                i.problem_definition,
                i.proposal,
                i.effect,
                i.user_id,
                u.displayed_name AS author_name,
                u.org_name AS author_org,
                u.job_title AS author_job_title,
                i.status,
                i.attachment_count,
                i.created_at,
                i.updated_at,
                i.reviewed_at,
                i.review_comment
            FROM ideas i
            LEFT JOIN user u ON u.user_id = i.user_id
            WHERE i.user_id = ?
            ORDER BY i.created_at DESC
            """,
            (current_user.user_id,),
        ).fetchall()
        return [idea_from_row(row, fetch_idea_attachments(con, row["idea_id"])) for row in rows]


@app.post("/api/ideas", response_model=IdeaResponse, status_code=status.HTTP_201_CREATED)
def create_idea(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    title: Annotated[str, Form()],
    problem_definition: Annotated[str, Form()],
    proposal: Annotated[str, Form()],
    effect: Annotated[str, Form()],
    attachments: list[UploadFile] = File(default=[]),
) -> IdeaResponse:
    clean_title = title.strip()
    clean_problem = problem_definition.strip()
    clean_proposal = proposal.strip()
    clean_effect = effect.strip()
    if not clean_title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="제목을 입력하세요.")
    if not clean_problem:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="문제 정의를 입력하세요.")
    if not clean_proposal:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="제안 내용을 입력하세요.")
    if not clean_effect:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="예상 효과를 입력하세요.")

    idea_id = str(uuid.uuid4())
    folder = idea_dir(idea_id)
    attachments_folder = idea_attachments_dir(idea_id)
    folder.mkdir(parents=True, exist_ok=False)
    attachments_folder.mkdir(parents=True, exist_ok=True)

    saved_attachments: list[tuple[str, str, str, int, str | None, str]] = []
    try:
        for upload in attachments:
            if not upload.filename:
                continue
            attachment_id = str(uuid.uuid4())
            original_name = Path(upload.filename).name
            stored_name = safe_attachment_filename(original_name)
            target = attachments_folder / stored_name
            with target.open("wb") as out_file:
                shutil.copyfileobj(upload.file, out_file)
            size = target.stat().st_size
            if size > 50 * 1024 * 1024:
                target.unlink(missing_ok=True)
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="첨부파일은 파일당 50MB 이하만 업로드할 수 있습니다.")
            saved_attachments.append((attachment_id, idea_id, original_name, stored_name, size, upload.content_type, utc_now()))
    except Exception:
        shutil.rmtree(folder, ignore_errors=True)
        raise

    now = utc_now()
    try:
        with get_connection() as con:
            con.execute(
                """
                INSERT INTO ideas (idea_id, title, problem_definition, proposal, effect, user_id, status, attachment_count, created_at, updated_at, reviewed_at)
                VALUES (?, ?, ?, ?, ?, ?, '접수완료', ?, ?, ?, NULL)
                """,
                (idea_id, clean_title, clean_problem, clean_proposal, clean_effect, current_user.user_id, len(saved_attachments), now, now),
            )
            con.executemany(
                """
                INSERT INTO idea_attachments (attachment_id, idea_id, original_name, stored_name, size, content_type, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                saved_attachments,
            )
            row = con.execute(
                """
                SELECT
                    i.idea_id,
                    i.title,
                    i.problem_definition,
                    i.proposal,
                    i.effect,
                    i.user_id,
                    u.displayed_name AS author_name,
                    u.org_name AS author_org,
                    u.job_title AS author_job_title,
                    i.status,
                    i.attachment_count,
                    i.created_at,
                    i.updated_at,
                    i.reviewed_at,
                i.review_comment
                FROM ideas i
                LEFT JOIN user u ON u.user_id = i.user_id
                WHERE i.idea_id = ?
                """,
                (idea_id,),
            ).fetchone()
            return idea_from_row(row, fetch_idea_attachments(con, idea_id))
    except Exception:
        shutil.rmtree(folder, ignore_errors=True)
        raise


@app.get("/api/ideas/{idea_id}", response_model=IdeaResponse)
def get_idea(idea_id: str, current_user: Annotated[UserResponse, Depends(get_current_user)]) -> IdeaResponse:
    with get_connection() as con:
        row = con.execute(
            """
            SELECT
                i.idea_id,
                i.title,
                i.problem_definition,
                i.proposal,
                i.effect,
                i.user_id,
                u.displayed_name AS author_name,
                u.org_name AS author_org,
                u.job_title AS author_job_title,
                i.status,
                i.attachment_count,
                i.created_at,
                i.updated_at,
                i.reviewed_at,
                i.review_comment
            FROM ideas i
            LEFT JOIN user u ON u.user_id = i.user_id
            WHERE i.idea_id = ? AND i.user_id = ?
            """,
            (idea_id, current_user.user_id),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="아이디어를 찾을 수 없습니다.")
        return idea_from_row(row, fetch_idea_attachments(con, idea_id))


@app.delete("/api/ideas/{idea_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_idea(idea_id: str, current_user: Annotated[UserResponse, Depends(get_current_user)]) -> None:
    with get_connection() as con:
        row = con.execute("SELECT user_id FROM ideas WHERE idea_id = ?", (idea_id,)).fetchone()
        if row is None or row["user_id"] != current_user.user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="아이디어를 찾을 수 없습니다.")
        con.execute("DELETE FROM idea_attachments WHERE idea_id = ?", (idea_id,))
        con.execute("DELETE FROM ideas WHERE idea_id = ?", (idea_id,))
    shutil.rmtree(idea_dir(idea_id), ignore_errors=True)


@app.get("/api/ideas/{idea_id}/attachments/{attachment_id}")
def get_idea_attachment(
    idea_id: str,
    attachment_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> FileResponse:
    with get_connection() as con:
        idea = con.execute("SELECT user_id FROM ideas WHERE idea_id = ?", (idea_id,)).fetchone()
        if idea is None or (idea["user_id"] != current_user.user_id and not current_user.is_admin):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="아이디어를 찾을 수 없습니다.")
        attachment = con.execute(
            """
            SELECT original_name, stored_name, content_type
            FROM idea_attachments
            WHERE idea_id = ? AND attachment_id = ?
            """,
            (idea_id, attachment_id),
        ).fetchone()
    if attachment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="첨부파일을 찾을 수 없습니다.")
    path = idea_attachments_dir(idea_id) / attachment["stored_name"]
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="첨부파일을 찾을 수 없습니다.")
    return FileResponse(path, media_type=attachment["content_type"], filename=attachment["original_name"])

@app.get("/api/usage-posts", response_model=list[AiUsagePostResponse])
def list_ai_usage_posts(current_user: Annotated[UserResponse, Depends(get_current_user)]) -> list[AiUsagePostResponse]:
    with get_connection() as con:
        rows = con.execute(
            """
            SELECT
                p.usage_post_id,
                p.title,
                p.category,
                p.user_id,
                u.displayed_name AS author_name,
                u.org_name AS author_org,
                u.job_title AS author_job_title,
                p.content_text,
                p.view_count,
                p.like_count,
                EXISTS(
                    SELECT 1 FROM ai_usage_post_likes l
                    WHERE l.usage_post_id = p.usage_post_id AND l.user_id = ?
                ) AS liked_by_me,
                p.created_at,
                p.updated_at
            FROM ai_usage_posts p
            LEFT JOIN user u ON u.user_id = p.user_id
            ORDER BY p.created_at DESC
            """,
            (current_user.user_id,),
        ).fetchall()
    return [ai_usage_post_from_row(row) for row in rows]


@app.get("/api/usage-posts/{usage_post_id}", response_model=AiUsagePostDetailResponse)
def get_ai_usage_post(
    usage_post_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    count_view: Annotated[bool, Query()] = True,
) -> AiUsagePostDetailResponse:
    with get_connection() as con:
        if count_view:
            result = con.execute("UPDATE ai_usage_posts SET view_count = view_count + 1 WHERE usage_post_id = ?", (usage_post_id,))
            if result.rowcount == 0:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="활용법 게시글을 찾을 수 없습니다.")
        row = con.execute(
            """
            SELECT
                p.usage_post_id,
                p.title,
                p.category,
                p.user_id,
                u.displayed_name AS author_name,
                u.org_name AS author_org,
                u.job_title AS author_job_title,
                p.content_text,
                p.view_count,
                p.like_count,
                EXISTS(
                    SELECT 1 FROM ai_usage_post_likes l
                    WHERE l.usage_post_id = p.usage_post_id AND l.user_id = ?
                ) AS liked_by_me,
                p.created_at,
                p.updated_at
            FROM ai_usage_posts p
            LEFT JOIN user u ON u.user_id = p.user_id
            WHERE p.usage_post_id = ?
            """,
            (current_user.user_id, usage_post_id),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="활용법 게시글을 찾을 수 없습니다.")

    post = ai_usage_post_from_row(row)
    content_path = usage_post_content_path(usage_post_id)
    content_html = content_path.read_text(encoding="utf-8") if content_path.exists() else ""
    return AiUsagePostDetailResponse(**post.__dict__, content_html=content_html)


@app.post("/api/usage-posts", response_model=AiUsagePostDetailResponse, status_code=status.HTTP_201_CREATED)
def create_ai_usage_post(
    payload: AiUsagePostCreateRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> AiUsagePostDetailResponse:
    clean_title = payload.title.strip()
    clean_category = payload.category.strip()
    content_html = payload.content_html.strip()
    if not clean_title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="제목을 입력하세요.")
    if clean_category not in {"확산 사례", "실패·교훈", "Tip 공유"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="경험 유형을 선택하세요.")
    if not text_from_html(content_html) and "<img" not in content_html.lower():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="본문을 입력하세요.")

    usage_post_id = str(uuid.uuid4())
    folder = usage_post_dir(usage_post_id)
    folder.mkdir(parents=True, exist_ok=False)
    try:
        normalized_html = normalize_usage_post_content(usage_post_id, content_html)
        usage_post_content_path(usage_post_id).write_text(normalized_html, encoding="utf-8")
    except Exception:
        shutil.rmtree(folder, ignore_errors=True)
        raise

    content_text = text_from_html(normalized_html)
    now = utc_now()
    with get_connection() as con:
        con.execute(
            """
            INSERT INTO ai_usage_posts (usage_post_id, title, category, user_id, content_text, view_count, like_count, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
            """,
            (usage_post_id, clean_title, clean_category, current_user.user_id, content_text, now, now),
        )
        row = con.execute(
            """
            SELECT
                p.usage_post_id,
                p.title,
                p.category,
                p.user_id,
                u.displayed_name AS author_name,
                u.org_name AS author_org,
                u.job_title AS author_job_title,
                p.content_text,
                p.view_count,
                p.like_count,
                0 AS liked_by_me,
                p.created_at,
                p.updated_at
            FROM ai_usage_posts p
            LEFT JOIN user u ON u.user_id = p.user_id
            WHERE p.usage_post_id = ?
            """,
            (usage_post_id,),
        ).fetchone()

    post = ai_usage_post_from_row(row)
    return AiUsagePostDetailResponse(**post.__dict__, content_html=normalized_html)


@app.put("/api/usage-posts/{usage_post_id}", response_model=AiUsagePostDetailResponse)
def update_ai_usage_post(
    usage_post_id: str,
    payload: AiUsagePostCreateRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> AiUsagePostDetailResponse:
    clean_title = payload.title.strip()
    clean_category = payload.category.strip()
    content_html = payload.content_html.strip()
    if not clean_title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="제목을 입력하세요.")
    if clean_category not in {"확산 사례", "실패·교훈", "Tip 공유"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="경험 유형을 선택하세요.")
    if not text_from_html(content_html) and "<img" not in content_html.lower():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="본문을 입력하세요.")

    folder = usage_post_dir(usage_post_id)
    with get_connection() as con:
        existing = con.execute(
            "SELECT user_id FROM ai_usage_posts WHERE usage_post_id = ?",
            (usage_post_id,),
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="활용법 게시글을 찾을 수 없습니다.")
        if existing["user_id"] != current_user.user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="내가 작성한 글만 수정할 수 있습니다.")

        folder.mkdir(parents=True, exist_ok=True)
        normalized_html = normalize_usage_post_content(usage_post_id, content_html)
        usage_post_content_path(usage_post_id).write_text(normalized_html, encoding="utf-8")
        content_text = text_from_html(normalized_html)
        con.execute(
            """
            UPDATE ai_usage_posts
            SET title = ?, category = ?, content_text = ?, updated_at = ?
            WHERE usage_post_id = ?
            """,
            (clean_title, clean_category, content_text, utc_now(), usage_post_id),
        )
        row = con.execute(
            """
            SELECT
                p.usage_post_id,
                p.title,
                p.category,
                p.user_id,
                u.displayed_name AS author_name,
                u.org_name AS author_org,
                u.job_title AS author_job_title,
                p.content_text,
                p.view_count,
                p.like_count,
                EXISTS(
                    SELECT 1 FROM ai_usage_post_likes l
                    WHERE l.usage_post_id = p.usage_post_id AND l.user_id = ?
                ) AS liked_by_me,
                p.created_at,
                p.updated_at
            FROM ai_usage_posts p
            LEFT JOIN user u ON u.user_id = p.user_id
            WHERE p.usage_post_id = ?
            """,
            (current_user.user_id, usage_post_id),
        ).fetchone()

    post = ai_usage_post_from_row(row)
    return AiUsagePostDetailResponse(**post.__dict__, content_html=normalized_html)


@app.post("/api/usage-posts/{usage_post_id}/like", response_model=AiUsagePostResponse)
def toggle_ai_usage_post_like(
    usage_post_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> AiUsagePostResponse:
    now = utc_now()
    with get_connection() as con:
        existing_post = con.execute("SELECT usage_post_id FROM ai_usage_posts WHERE usage_post_id = ?", (usage_post_id,)).fetchone()
        if existing_post is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="활용법 게시글을 찾을 수 없습니다.")
        existing_like = con.execute(
            "SELECT 1 FROM ai_usage_post_likes WHERE usage_post_id = ? AND user_id = ?",
            (usage_post_id, current_user.user_id),
        ).fetchone()
        if existing_like:
            con.execute("DELETE FROM ai_usage_post_likes WHERE usage_post_id = ? AND user_id = ?", (usage_post_id, current_user.user_id))
            con.execute("UPDATE ai_usage_posts SET like_count = MAX(0, like_count - 1) WHERE usage_post_id = ?", (usage_post_id,))
        else:
            con.execute(
                "INSERT INTO ai_usage_post_likes (usage_post_id, user_id, created_at) VALUES (?, ?, ?)",
                (usage_post_id, current_user.user_id, now),
            )
            con.execute("UPDATE ai_usage_posts SET like_count = like_count + 1 WHERE usage_post_id = ?", (usage_post_id,))
        row = con.execute(
            """
            SELECT
                p.usage_post_id,
                p.title,
                p.category,
                p.user_id,
                u.displayed_name AS author_name,
                u.org_name AS author_org,
                u.job_title AS author_job_title,
                p.content_text,
                p.view_count,
                p.like_count,
                EXISTS(
                    SELECT 1 FROM ai_usage_post_likes l
                    WHERE l.usage_post_id = p.usage_post_id AND l.user_id = ?
                ) AS liked_by_me,
                p.created_at,
                p.updated_at
            FROM ai_usage_posts p
            LEFT JOIN user u ON u.user_id = p.user_id
            WHERE p.usage_post_id = ?
            """,
            (current_user.user_id, usage_post_id),
        ).fetchone()
    return ai_usage_post_from_row(row)


@app.get("/api/usage-posts/{usage_post_id}/assets/{filename}")
def get_ai_usage_post_asset(usage_post_id: str, filename: str) -> FileResponse:
    if "/" in filename or ".." in filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="잘못된 파일명입니다.")
    path = usage_post_assets_dir(usage_post_id) / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="이미지를 찾을 수 없습니다.")
    return FileResponse(path)


@app.get("/api/news", response_model=list[NewsResponse])
def list_news() -> list[NewsResponse]:
    with get_connection() as con:
        rows = con.execute(
            """
            SELECT n.news_id, n.title, n.writer, u.displayed_name AS writer_name, n.cover_image, n.view_count, n.created_at, n.updated_at
            FROM news n
            LEFT JOIN user u ON u.user_id = n.writer
            ORDER BY n.created_at DESC
            """
        ).fetchall()
    return [news_from_row(row) for row in rows]


@app.get("/api/news/{news_id}", response_model=NewsDetailResponse)
def get_news(news_id: str, count_view: Annotated[bool, Query()] = True) -> NewsDetailResponse:
    with get_connection() as con:
        if count_view:
            result = con.execute("UPDATE news SET view_count = view_count + 1 WHERE news_id = ?", (news_id,))
            if result.rowcount == 0:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="뉴스를 찾을 수 없습니다.")
        row = con.execute(
            """
            SELECT n.news_id, n.title, n.writer, u.displayed_name AS writer_name, n.cover_image, n.view_count, n.created_at, n.updated_at
            FROM news n
            LEFT JOIN user u ON u.user_id = n.writer
            WHERE n.news_id = ?
            """,
            (news_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="뉴스를 찾을 수 없습니다.")

    md_path = markdown_path(news_id)
    markdown = md_path.read_text(encoding="utf-8") if md_path.exists() else ""
    news = news_from_row(row)
    return NewsDetailResponse(
        news_id=news.news_id,
        title=news.title,
        writer=news.writer,
        writer_name=news.writer_name,
        cover_image=news.cover_image,
        cover_image_url=news.cover_image_url,
        view_count=news.view_count,
        created_at=news.created_at,
        updated_at=news.updated_at,
        markdown=markdown,
    )


@app.get("/api/news/{news_id}/cover")
def get_news_cover(news_id: str) -> FileResponse:
    with get_connection() as con:
        row = con.execute("SELECT cover_image FROM news WHERE news_id = ?", (news_id,)).fetchone()
    if row is None or not row["cover_image"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="커버 이미지를 찾을 수 없습니다.")

    path = news_dir(news_id) / row["cover_image"]
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="커버 이미지 파일을 찾을 수 없습니다.")
    return FileResponse(path)


@app.post("/api/admin/news/draft", response_model=NewsDraftResponse)
def draft_news(payload: NewsDraftRequest, _: Annotated[UserResponse, Depends(require_admin)]) -> NewsDraftResponse:
    prompt = f"""
다음 기사 소스 또는 원문 자료를 바탕으로 사내 AI Tech News 게시글을 작성해줘.

작성 규칙:
- 출력은 Markdown 본문만 작성한다. 코드블록으로 감싸지 않는다.
- 첫 줄은 게시글 제목으로 쓰기 좋은 H1(`# ...`)을 작성한다.
- 전체 본문은 한글로 작성한다. 단, 고유명사, 제품명, 기술명, 원문 인용은 필요한 경우 원문 표기를 유지한다.
- 원문에 없는 사실을 새로 만들지 않는다. 추론이 필요한 내용은 조심스럽게 표현한다.
- 핵심 요약, 주요 내용, 시사점, 현업 적용 아이디어 순서로 구성한다.
- 독자는 제조업/사내 업무 담당자라고 가정하고 쉬운 한국어로 쓴다.
- 과장된 홍보 문구는 피하고, 구체적이고 실무적인 표현을 사용한다.

기사 소스:
{payload.source.strip()}
"""
    try:
        markdown = chat_completion(prompt, temperature=0)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"LLM 초안 생성에 실패했습니다: {exc}") from exc
    return NewsDraftResponse(markdown=markdown)


@app.post("/api/admin/news", response_model=NewsResponse, status_code=status.HTTP_201_CREATED)
def create_news(
    current_user: Annotated[UserResponse, Depends(require_admin)],
    title: Annotated[str, Form()],
    markdown: Annotated[str, Form()],
    cover_image: Annotated[UploadFile | None, File()] = None,
) -> NewsResponse:
    clean_title = title.strip()
    if not clean_title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="제목을 입력하세요.")

    news_id = str(uuid.uuid4())
    now = utc_now()
    folder = news_dir(news_id)
    folder.mkdir(parents=True, exist_ok=False)
    markdown_path(news_id).write_text(markdown, encoding="utf-8")
    cover_filename = save_cover_image(news_id, cover_image)

    with get_connection() as con:
        con.execute(
            """
            INSERT INTO news (news_id, title, writer, cover_image, view_count, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, ?, ?)
            """,
            (news_id, clean_title, current_user.user_id, cover_filename, now, now),
        )
        row = con.execute(
            """
            SELECT n.news_id, n.title, n.writer, u.displayed_name AS writer_name, n.cover_image, n.view_count, n.created_at, n.updated_at
            FROM news n
            LEFT JOIN user u ON u.user_id = n.writer
            WHERE n.news_id = ?
            """,
            (news_id,),
        ).fetchone()

    return news_from_row(row)


@app.put("/api/admin/news/{news_id}", response_model=NewsResponse)
def update_news(
    news_id: str,
    _: Annotated[UserResponse, Depends(require_admin)],
    title: Annotated[str, Form()],
    markdown: Annotated[str, Form()],
    cover_image: Annotated[UploadFile | None, File()] = None,
) -> NewsResponse:
    clean_title = title.strip()
    if not clean_title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="제목을 입력하세요.")

    folder = news_dir(news_id)
    with get_connection() as con:
        existing = con.execute("SELECT cover_image FROM news WHERE news_id = ?", (news_id,)).fetchone()
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="뉴스를 찾을 수 없습니다.")

        folder.mkdir(parents=True, exist_ok=True)
        markdown_path(news_id).write_text(markdown, encoding="utf-8")

        cover_filename = existing["cover_image"]
        if cover_image is not None and cover_image.filename:
            if cover_filename:
                old_cover = folder / cover_filename
                if old_cover.exists():
                    old_cover.unlink()
            cover_filename = save_cover_image(news_id, cover_image)

        con.execute(
            """
            UPDATE news
            SET title = ?, cover_image = ?, updated_at = ?
            WHERE news_id = ?
            """,
            (clean_title, cover_filename, utc_now(), news_id),
        )
        row = con.execute(
            """
            SELECT n.news_id, n.title, n.writer, u.displayed_name AS writer_name, n.cover_image, n.view_count, n.created_at, n.updated_at
            FROM news n
            LEFT JOIN user u ON u.user_id = n.writer
            WHERE n.news_id = ?
            """,
            (news_id,),
        ).fetchone()

    return news_from_row(row)


@app.delete("/api/admin/news/{news_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_news(news_id: str, _: Annotated[UserResponse, Depends(require_admin)]) -> None:
    with get_connection() as con:
        result = con.execute("DELETE FROM news WHERE news_id = ?", (news_id,))
        if result.rowcount == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="뉴스를 찾을 수 없습니다.")

    shutil.rmtree(news_dir(news_id), ignore_errors=True)

