from __future__ import annotations

import base64
import hashlib
import hmac
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from pydantic import BaseModel, Field

from llm_client import chat_completion
from harness_generator import iter_generate_skill_package, plan_skill_candidates


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "app.db"
NEWS_WORKSPACE = BASE_DIR / "workspace" / "tech_news"
USAGE_POSTS_WORKSPACE = BASE_DIR / "workspace" / "usage_posts"
IDEAS_WORKSPACE = BASE_DIR / "workspace" / "ideas"
ASSETS_WORKSPACE = BASE_DIR / "workspace" / "assets"
STAGING_WORKSPACE = BASE_DIR / "staging" / "assets"
TEMPLATES_DIR = BASE_DIR / "templates"
ASSET_REGISTRATION_TEMPLATE = TEMPLATES_DIR / "asset_registration.html"
SAMPLE_ASSET_DIR = BASE_DIR.parent / "sample"
PROMPTS_DIR = BASE_DIR / "prompts"
PBKDF2_ITERATIONS = 210_000
MAX_ASSET_DATA_FILE_SIZE = 10 * 1024 * 1024

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
    expose_headers=["X-Diffusion-Attempt-Count"],
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


class DxChatMessage(BaseModel):
    role: str
    text: str


class DxDiscoveryChatRequest(BaseModel):
    messages: list[DxChatMessage] = Field(default_factory=list)


class DxDiscoveryChatResponse(BaseModel):
    reply: str
    is_complete: bool = False
    fields: dict[str, str | list[str] | list[dict[str, str]]] = Field(default_factory=dict)


class DxDiscoveryMessageResponse(BaseModel):
    message_id: str
    session_id: str
    role: str
    content: str
    seq: int
    created_at: str


class DxDiscoverySessionResponse(BaseModel):
    session_id: str
    user_id: str
    title: str
    status: str
    fields: dict[str, str | list[str] | list[dict[str, str]]] = Field(default_factory=dict)
    recommended_data_ids: list[str] = Field(default_factory=list)
    recommended_asset_ids: list[str] = Field(default_factory=list)
    created_at: str
    updated_at: str
    completed_at: str | None = None


class DxDiscoverySessionDetailResponse(DxDiscoverySessionResponse):
    messages: list[DxDiscoveryMessageResponse] = Field(default_factory=list)


class DxDiscoverySessionCreateResponse(DxDiscoverySessionDetailResponse):
    pass


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


class AssetStatusUpdateRequest(BaseModel):
    status: str = Field(min_length=1)
    review_comment: str = Field(min_length=1)


class AssetActivationRequest(BaseModel):
    is_active: bool


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

class AssetQaQuestionRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    topic: str = Field(default="적용 문의", min_length=1, max_length=80)


class AssetQaContentRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class AssetQaReplyResponse(BaseModel):
    qa_post_id: str
    asset_id: str
    user_id: str
    parent_post_id: str
    content: str
    writer_name: str
    writer_org: str
    writer_job_title: str
    is_owner: bool = False
    can_edit: bool = False
    created_at: str
    updated_at: str


class AssetQaQuestionResponse(BaseModel):
    qa_post_id: str
    asset_id: str
    user_id: str
    topic: str
    content: str
    helpful_count: int = 0
    helpful_by_me: bool = False
    writer_name: str
    writer_org: str
    writer_job_title: str
    is_owner: bool = False
    can_edit: bool = False
    replies: list[AssetQaReplyResponse] = Field(default_factory=list)
    created_at: str
    updated_at: str


class AssetQaHelpfulResponse(BaseModel):
    helpful_count: int
    helpful_by_me: bool


class AssetDiffusionCaseRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    stage: str = Field(min_length=1, max_length=20)
    applied_work: str = Field(min_length=1, max_length=4000)
    customization: str = Field(min_length=1, max_length=4000)
    effect: str = Field(min_length=1, max_length=4000)
    git_url: str | None = Field(default=None, max_length=1000)


class AssetDiffusionCaseResponse(BaseModel):
    diffusion_case_id: str
    asset_id: str
    user_id: str
    title: str
    stage: str
    stage_label: str
    applied_work: str
    customization: str
    effect: str
    git_url: str | None = None
    writer_name: str
    writer_org: str
    writer_job_title: str
    can_edit: bool = False
    created_at: str
    updated_at: str


class AssetDiffusionCaseMutationResponse(BaseModel):
    case: AssetDiffusionCaseResponse | None = None
    diffusion_completed_count: int


class AiAssetResponse(BaseModel):
    asset_id: str
    asset_name: str
    description: str
    business_area: str
    maturity_level: str
    approval_status: str
    view_count: int = 0
    diffusion_attempt_count: int = 0
    diffusion_completed_count: int = 0
    is_active: bool = True
    created_by: str
    owner_name: str | None = None
    owner_org: str | None = None
    owner_job_title: str | None = None
    created_at: str
    updated_at: str
    submitted_at: str | None = None
    reviewed_at: str | None = None
    reviewed_by: str | None = None
    review_comment: str | None = None


class AssetRepositoryCloneRequest(BaseModel):
    repo_url: str = Field(min_length=1)
    repo_branch: str | None = None
    asset_id: str | None = None


class AssetRepositoryTreeItem(BaseModel):
    name: str
    path: str
    type: str
    children: list["AssetRepositoryTreeItem"] = Field(default_factory=list)


class AssetRepositoryCloneResponse(BaseModel):
    asset_id: str
    repo_url: str
    repo_branch: str | None = None
    tree: list[AssetRepositoryTreeItem] = Field(default_factory=list)


class AssetStagingResponse(BaseModel):
    asset_id: str
    meta_path: str
    updated_at: str


class AssetSkillPlanResponse(BaseModel):
    asset_id: str
    asset_summary: str = ''
    reusable_patterns: list[str] = Field(default_factory=list)
    candidates: list[dict[str, Any]] = Field(default_factory=list)
    selected_skill_slugs: list[str] = Field(default_factory=list)


class AssetSkillGenerateRequest(BaseModel):
    selected_skill_slugs: list[str] = Field(default_factory=list)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_prompt(name: str) -> str:
    path = PROMPTS_DIR / name
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"프롬프트 파일을 찾을 수 없습니다: {name}")
    return path.read_text(encoding="utf-8")


def extract_json_object(text: str) -> dict:
    clean = text.strip()
    if clean.startswith("```"):
        clean = re.sub(r"^```(?:json)?\s*", "", clean)
        clean = re.sub(r"\s*```$", "", clean)
    start = clean.find("{")
    end = clean.rfind("}")
    if start >= 0 and end >= start:
        clean = clean[start:end + 1]
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        return {"reply": text.strip() or "응답을 해석하지 못했습니다. 다시 입력해 주세요.", "is_complete": False, "fields": {}}


def format_dx_conversation(messages: list[DxChatMessage]) -> str:
    if not messages:
        return "대화 없음"
    lines = []
    for message in messages[-20:]:
        role = "사용자" if message.role == "user" else "Agent"
        lines.append(f"{role}: {message.text.strip()}")
    return "\n".join(lines)


def normalize_dx_fields(raw_fields: object) -> dict[str, str | list[str] | list[dict[str, str]]]:
    if not isinstance(raw_fields, dict):
        return {}

    list_fields = {"pain_points", "quantitative_effect", "qualitative_effect", "beneficiaries"}
    fields: dict[str, str | list[str] | list[dict[str, str]]] = {}
    for key, value in raw_fields.items():
        if key == "required_data":
            if isinstance(value, list):
                rows: list[dict[str, str]] = []
                for item in value:
                    if isinstance(item, dict):
                        data_name = str(item.get("data_name") or item.get("name") or "").strip()
                        description = str(item.get("description") or item.get("desc") or "").strip()
                        if data_name or description:
                            rows.append({"data_name": data_name, "description": description})
                    elif str(item).strip():
                        rows.append({"data_name": str(item).strip(), "description": ""})
                fields[key] = rows
            elif value:
                fields[key] = [{"data_name": str(value).strip(), "description": ""}]
            else:
                fields[key] = []
        elif key in list_fields:
            if isinstance(value, list):
                fields[key] = [str(item).strip() for item in value if str(item).strip()]
            elif value:
                fields[key] = [str(value).strip()]
            else:
                fields[key] = []
        else:
            fields[key] = str(value).strip() if value is not None else ""
    return fields


DX_IN_PROGRESS_STATUS = "과제 발굴 중"
DX_COMPLETE_STATUS = "과제 발굴 완료"
DX_DEFAULT_TITLE = "과제 발굴 중..."


def load_json_value(value: str | None, fallback: object) -> object:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def merge_dx_fields(
    existing: dict[str, str | list[str] | list[dict[str, str]]],
    incoming: dict[str, str | list[str] | list[dict[str, str]]],
) -> dict[str, str | list[str] | list[dict[str, str]]]:
    merged = dict(existing)
    for key, value in incoming.items():
        if isinstance(value, list):
            if value:
                merged[key] = value
        elif str(value).strip():
            merged[key] = value
    return merged


def dx_session_from_row(row: sqlite3.Row) -> DxDiscoverySessionResponse:
    fields = normalize_dx_fields(load_json_value(row["fields_json"], {}))
    data_ids = load_json_value(row["recommended_data_ids_json"], [])
    asset_ids = load_json_value(row["recommended_asset_ids_json"], [])
    return DxDiscoverySessionResponse(
        session_id=row["session_id"],
        user_id=row["user_id"],
        title=row["title"],
        status=row["status"],
        fields=fields,
        recommended_data_ids=[str(item) for item in data_ids] if isinstance(data_ids, list) else [],
        recommended_asset_ids=[str(item) for item in asset_ids] if isinstance(asset_ids, list) else [],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        completed_at=row["completed_at"],
    )


def dx_message_from_row(row: sqlite3.Row) -> DxDiscoveryMessageResponse:
    return DxDiscoveryMessageResponse(
        message_id=row["message_id"],
        session_id=row["session_id"],
        role=row["role"],
        content=row["content"],
        seq=int(row["seq"]),
        created_at=row["created_at"],
    )


def fetch_dx_session(con: sqlite3.Connection, session_id: str, user_id: str) -> sqlite3.Row:
    row = con.execute(
        """
        SELECT session_id, user_id, title, status, fields_json, recommended_data_ids_json,
               recommended_asset_ids_json, created_at, updated_at, completed_at
        FROM dx_discovery_sessions
        WHERE session_id = ? AND user_id = ?
        """,
        (session_id, user_id),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DX 과제 발굴 세션을 찾을 수 없습니다.")
    return row


def fetch_dx_messages(con: sqlite3.Connection, session_id: str) -> list[DxDiscoveryMessageResponse]:
    rows = con.execute(
        """
        SELECT message_id, session_id, role, content, seq, created_at
        FROM dx_discovery_messages
        WHERE session_id = ?
        ORDER BY seq ASC
        """,
        (session_id,),
    ).fetchall()
    return [dx_message_from_row(row) for row in rows]


def next_dx_message_seq(con: sqlite3.Connection, session_id: str) -> int:
    value = con.execute("SELECT COALESCE(MAX(seq), 0) + 1 FROM dx_discovery_messages WHERE session_id = ?", (session_id,)).fetchone()[0]
    return int(value)


def run_dx_agent(messages: list[DxChatMessage]) -> DxDiscoveryChatResponse:
    conversation = format_dx_conversation(messages)
    prompt = read_prompt("dx_discovery_agent.txt").replace("{{conversation}}", conversation)
    try:
        raw_response = chat_completion(prompt, temperature=0)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"LLM 응답을 생성하지 못했습니다: {exc}")

    data = extract_json_object(raw_response)
    return DxDiscoveryChatResponse(
        reply=str(data.get("reply") or "다음 정보를 조금 더 알려주세요."),
        is_complete=bool(data.get("is_complete")),
        fields=normalize_dx_fields(data.get("fields")),
    )


def get_connection() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
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
            CREATE TABLE IF NOT EXISTS dx_discovery_sessions (
                session_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL DEFAULT '과제 발굴 중...',
                status TEXT NOT NULL DEFAULT '과제 발굴 중',
                fields_json TEXT NOT NULL DEFAULT '{}',
                recommended_data_ids_json TEXT NOT NULL DEFAULT '[]',
                recommended_asset_ids_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                completed_at TEXT,
                FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
            )
            """
        )
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS dx_discovery_messages (
                message_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                seq INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES dx_discovery_sessions(session_id) ON DELETE CASCADE
            )
            """
        )
        con.execute("CREATE INDEX IF NOT EXISTS idx_dx_discovery_sessions_user_updated_at ON dx_discovery_sessions(user_id, updated_at)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_dx_discovery_messages_session_seq ON dx_discovery_messages(session_id, seq)")
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
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_assets (
                asset_id TEXT PRIMARY KEY,
                asset_name TEXT NOT NULL,
                description TEXT NOT NULL,
                business_area TEXT NOT NULL,
                maturity_level TEXT NOT NULL,
                task_types_json TEXT NOT NULL DEFAULT '[]',
                implementation_types_json TEXT NOT NULL DEFAULT '[]',
                tags_json TEXT NOT NULL DEFAULT '[]',
                problem_definition TEXT NOT NULL,
                as_is_workflow TEXT NOT NULL,
                to_be_workflow TEXT NOT NULL,
                ai_effect TEXT NOT NULL,
                has_data INTEGER NOT NULL DEFAULT 1,
                has_train_validation_split INTEGER NOT NULL DEFAULT 0,
                data_type TEXT,
                data_description TEXT,
                models_json TEXT NOT NULL DEFAULT '[]',
                tech_stacks_json TEXT NOT NULL DEFAULT '[]',
                before_after_metrics_json TEXT NOT NULL DEFAULT '[]',
                performance_metrics_json TEXT NOT NULL DEFAULT '[]',
                repo_url TEXT,
                repo_branch TEXT,
                skill_status TEXT NOT NULL DEFAULT 'not_created',
                skill_zip_path TEXT,
                diffusion_prompt TEXT,
                skill_generated_at TEXT,
                approval_status TEXT NOT NULL DEFAULT 'submitted',
                is_active INTEGER NOT NULL DEFAULT 1,
                view_count INTEGER NOT NULL DEFAULT 0,
                diffusion_attempt_count INTEGER NOT NULL DEFAULT 0,
                diffusion_completed_count INTEGER NOT NULL DEFAULT 0,
                created_by TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                submitted_at TEXT,
                reviewed_at TEXT,
                reviewed_by TEXT,
                review_comment TEXT,
                FOREIGN KEY (created_by) REFERENCES user(user_id) ON DELETE RESTRICT
            )
            """
        )
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_asset_slides (
                slide_id TEXT PRIMARY KEY,
                asset_id TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                caption TEXT,
                description TEXT,
                sort_order INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (asset_id) REFERENCES ai_assets(asset_id) ON DELETE CASCADE
            )
            """
        )
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_asset_data_files (
                data_file_id TEXT PRIMARY KEY,
                asset_id TEXT NOT NULL,
                data_role TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER,
                content_type TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (asset_id) REFERENCES ai_assets(asset_id) ON DELETE CASCADE
            )
            """
        )
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_asset_skill_files (
                skill_file_id TEXT PRIMARY KEY,
                asset_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (asset_id) REFERENCES ai_assets(asset_id) ON DELETE CASCADE
            )
            """
        )
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_asset_bookmarks (
                user_id TEXT NOT NULL,
                asset_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (user_id, asset_id),
                FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
                FOREIGN KEY (asset_id) REFERENCES ai_assets(asset_id) ON DELETE CASCADE
            )
            """
        )
        diffusion_attempts_table_exists = con.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'ai_asset_diffusion_attempts'"
        ).fetchone() is not None
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_asset_diffusion_attempts (
                asset_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                first_attempted_at TEXT NOT NULL,
                PRIMARY KEY (asset_id, user_id),
                FOREIGN KEY (asset_id) REFERENCES ai_assets(asset_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
            )
            """
        )
        con.execute(
            """
            CREATE TRIGGER IF NOT EXISTS trg_ai_asset_diffusion_attempt_insert
            AFTER INSERT ON ai_asset_diffusion_attempts
            BEGIN
                UPDATE ai_assets
                SET diffusion_attempt_count = diffusion_attempt_count + 1
                WHERE asset_id = NEW.asset_id;
            END
            """
        )
        con.execute(
            """
            CREATE TRIGGER IF NOT EXISTS trg_ai_asset_diffusion_attempt_delete
            AFTER DELETE ON ai_asset_diffusion_attempts
            BEGIN
                UPDATE ai_assets
                SET diffusion_attempt_count = MAX(diffusion_attempt_count - 1, 0)
                WHERE asset_id = OLD.asset_id;
            END
            """
        )
        diffusion_cases_table_exists = con.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'ai_asset_diffusion_cases'"
        ).fetchone() is not None
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_asset_diffusion_cases (
                diffusion_case_id TEXT PRIMARY KEY,
                asset_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                stage TEXT NOT NULL CHECK (stage IN ('poc', 'pilot', 'production')),
                applied_work TEXT NOT NULL,
                customization TEXT NOT NULL,
                effect TEXT NOT NULL,
                git_url TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (asset_id) REFERENCES ai_assets(asset_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE RESTRICT
            )
            """
        )
        con.execute(
            """
            CREATE TRIGGER IF NOT EXISTS trg_ai_asset_diffusion_case_insert
            AFTER INSERT ON ai_asset_diffusion_cases
            BEGIN
                UPDATE ai_assets
                SET diffusion_completed_count = diffusion_completed_count + 1
                WHERE asset_id = NEW.asset_id;
            END
            """
        )
        con.execute(
            """
            CREATE TRIGGER IF NOT EXISTS trg_ai_asset_diffusion_case_delete
            AFTER DELETE ON ai_asset_diffusion_cases
            BEGIN
                UPDATE ai_assets
                SET diffusion_completed_count = MAX(diffusion_completed_count - 1, 0)
                WHERE asset_id = OLD.asset_id;
            END
            """
        )
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_asset_qa_posts (
                qa_post_id TEXT PRIMARY KEY,
                asset_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                parent_post_id TEXT,
                topic TEXT NOT NULL DEFAULT '적용 문의',
                content TEXT NOT NULL,
                helpful_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (asset_id) REFERENCES ai_assets(asset_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE RESTRICT,
                FOREIGN KEY (parent_post_id) REFERENCES ai_asset_qa_posts(qa_post_id) ON DELETE CASCADE
            )
            """
        )
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_asset_qa_helpful (
                qa_post_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (qa_post_id, user_id),
                FOREIGN KEY (qa_post_id) REFERENCES ai_asset_qa_posts(qa_post_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
            )
            """
        )
        con.execute(
            """
            CREATE TRIGGER IF NOT EXISTS trg_ai_asset_qa_helpful_insert
            AFTER INSERT ON ai_asset_qa_helpful
            BEGIN
                UPDATE ai_asset_qa_posts
                SET helpful_count = helpful_count + 1
                WHERE qa_post_id = NEW.qa_post_id;
            END
            """
        )
        con.execute(
            """
            CREATE TRIGGER IF NOT EXISTS trg_ai_asset_qa_helpful_delete
            AFTER DELETE ON ai_asset_qa_helpful
            BEGIN
                UPDATE ai_asset_qa_posts
                SET helpful_count = MAX(helpful_count - 1, 0)
                WHERE qa_post_id = OLD.qa_post_id;
            END
            """
        )
        asset_columns = {row[1] for row in con.execute("PRAGMA table_info(ai_assets)")}
        asset_column_migrations = {
            "approval_status": "TEXT NOT NULL DEFAULT " + chr(39) + "submitted" + chr(39),
            "submitted_at": "TEXT",
            "reviewed_at": "TEXT",
            "reviewed_by": "TEXT",
            "review_comment": "TEXT",
            "is_active": "INTEGER NOT NULL DEFAULT 1",
        }
        for column_name, column_type in asset_column_migrations.items():
            if column_name not in asset_columns:
                con.execute(f"ALTER TABLE ai_assets ADD COLUMN {column_name} {column_type}")
        if "has_train_validation_split" not in asset_columns:
            con.execute("ALTER TABLE ai_assets ADD COLUMN has_train_validation_split INTEGER NOT NULL DEFAULT 0")
        for metric_column in ("view_count", "diffusion_attempt_count", "diffusion_completed_count"):
            if metric_column not in asset_columns:
                con.execute(f"ALTER TABLE ai_assets ADD COLUMN {metric_column} INTEGER NOT NULL DEFAULT 0")
        if not diffusion_attempts_table_exists:
            con.execute("UPDATE ai_assets SET diffusion_attempt_count = 0")
        if not diffusion_cases_table_exists:
            con.execute("UPDATE ai_assets SET diffusion_completed_count = 0")
        con.execute("CREATE INDEX IF NOT EXISTS idx_ai_assets_created_at ON ai_assets(created_at)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_ai_assets_approval_status ON ai_assets(approval_status)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_ai_asset_slides_asset_order ON ai_asset_slides(asset_id, sort_order)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_ai_asset_data_files_asset_role ON ai_asset_data_files(asset_id, data_role)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_ai_asset_skill_files_asset_path ON ai_asset_skill_files(asset_id, file_path)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_ai_asset_bookmarks_user_created ON ai_asset_bookmarks(user_id, created_at DESC)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_ai_asset_diffusion_attempts_user ON ai_asset_diffusion_attempts(user_id, first_attempted_at DESC)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_ai_asset_diffusion_cases_asset_created ON ai_asset_diffusion_cases(asset_id, created_at DESC)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_ai_asset_diffusion_cases_user_created ON ai_asset_diffusion_cases(user_id, created_at DESC)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_ai_asset_qa_posts_asset_created ON ai_asset_qa_posts(asset_id, created_at DESC)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_ai_asset_qa_posts_parent_created ON ai_asset_qa_posts(parent_post_id, created_at)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_ai_asset_qa_posts_user_created ON ai_asset_qa_posts(user_id, created_at DESC)")
        NEWS_WORKSPACE.mkdir(parents=True, exist_ok=True)
        USAGE_POSTS_WORKSPACE.mkdir(parents=True, exist_ok=True)
        IDEAS_WORKSPACE.mkdir(parents=True, exist_ok=True)
        ASSETS_WORKSPACE.mkdir(parents=True, exist_ok=True)
        STAGING_WORKSPACE.mkdir(parents=True, exist_ok=True)
        for asset_row in con.execute("SELECT asset_id FROM ai_assets").fetchall():
            asset_id = str(asset_row["asset_id"])
            if finalize_submitted_asset_storage(asset_id):
                con.execute(
                    "UPDATE ai_assets SET skill_zip_path = ? WHERE asset_id = ?",
                    (f"workspace/assets/{asset_id}/skill.zip", asset_id),
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

def asset_dir(asset_id: str) -> Path:
    return ASSETS_WORKSPACE / asset_id


def asset_slides_dir(asset_id: str) -> Path:
    return asset_dir(asset_id) / "slides"


def asset_skills_dir(asset_id: str) -> Path:
    return asset_dir(asset_id) / "skills"


def asset_data_dir(asset_id: str, role: str) -> Path:
    return asset_dir(asset_id) / "data" / role


def staging_dir(asset_id: str) -> Path:
    return STAGING_WORKSPACE / asset_id


def staging_repo_dir(asset_id: str) -> Path:
    return staging_dir(asset_id) / "repo"


def staging_slides_dir(asset_id: str) -> Path:
    return staging_dir(asset_id) / "slides"


def staging_data_dir(asset_id: str, role: str) -> Path:
    return staging_dir(asset_id) / "data" / role


def staging_meta_path(asset_id: str) -> Path:
    return staging_dir(asset_id) / "meta.json"


def finalize_submitted_asset_storage(asset_id: str) -> bool:
    source_root = staging_dir(asset_id)
    source_skills = source_root / "skills"
    workspace_root = asset_dir(asset_id)
    workspace_skills = asset_skills_dir(asset_id)
    workspace_root.mkdir(parents=True, exist_ok=True)

    if source_skills.is_dir():
        shutil.copytree(source_skills, workspace_skills, dirs_exist_ok=True)

    legacy_zip = workspace_skills / "skill.zip"
    root_zip = workspace_root / "skill.zip"
    if legacy_zip.is_file():
        if root_zip.exists():
            legacy_zip.unlink()
        else:
            shutil.move(str(legacy_zip), str(root_zip))

    if source_root.exists():
        shutil.rmtree(source_root)
    return root_zip.is_file()


def load_staging_meta_for_user(asset_id: str, current_user: UserResponse) -> dict:
    meta_path = staging_meta_path(asset_id)
    if not meta_path.exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자산 명세서 임시 저장 정보가 없습니다. 먼저 자산 명세서 작성 단계에서 다음을 눌러 저장하세요.")
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="자산 임시 저장 정보 형식이 올바르지 않습니다.")
    if not isinstance(meta, dict):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="자산 임시 저장 정보 형식이 올바르지 않습니다.")
    owner_id = str(meta.get("user_id") or meta.get("payload", {}).get("user_id") or "")
    if owner_id and owner_id != current_user.user_id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="이 자산의 확산 패키지를 생성할 권한이 없습니다.")
    return meta


def safe_upload_filename(original_name: str, fallback_suffix: str = ".file") -> str:
    suffix = Path(original_name).suffix.lower()
    if not suffix or len(suffix) > 20:
        suffix = fallback_suffix
    return f"{uuid.uuid4().hex}{suffix}"


def require_text(payload: dict, key: str, label: str) -> str:
    value = str(payload.get(key) or "").strip()
    if not value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{label}을 입력하세요.")
    return value


def json_text(value: object) -> str:
    return json.dumps(value, ensure_ascii=False)


def validate_asset_id(value: str | None) -> str:
    if not value:
        return str(uuid.uuid4())
    try:
        return str(uuid.UUID(value))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자산 ID 형식이 올바르지 않습니다.")


def list_repository_tree(root: Path, base: Path | None = None, depth: int = 0, max_depth: int = 5) -> list[AssetRepositoryTreeItem]:
    base = base or root
    if depth > max_depth or not root.exists():
        return []
    items: list[AssetRepositoryTreeItem] = []
    try:
        children = sorted(root.iterdir(), key=lambda item: (not item.is_dir(), item.name.lower()))
    except OSError:
        return items
    for child in children:
        if child.name in {".git", "__pycache__", ".venv", "node_modules"}:
            continue
        rel_path = child.relative_to(base).as_posix()
        if child.is_dir():
            items.append(AssetRepositoryTreeItem(name=child.name, path=rel_path, type="directory", children=list_repository_tree(child, base, depth + 1, max_depth)))
        else:
            items.append(AssetRepositoryTreeItem(name=child.name, path=rel_path, type="file"))
        if len(items) >= 160:
            break
    return items


def repository_tree_payload(root: Path) -> list[dict[str, Any]]:
    items = list_repository_tree(root)
    return [item.model_dump() if hasattr(item, "model_dump") else item.dict() for item in items]


def read_json_object(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return value if isinstance(value, dict) else {}


def load_json_list(value: str | None) -> list[Any]:
    try:
        parsed = json.loads(value or "[]")
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def ai_asset_catalog_payload(con: sqlite3.Connection, row: sqlite3.Row, include_detail: bool = False) -> dict[str, Any]:
    payload = dict(row)
    for field in ("task_types", "implementation_types", "tags", "models", "tech_stacks", "before_after_metrics", "performance_metrics"):
        payload[field] = load_json_list(payload.pop(f"{field}_json", None))
    payload["is_active"] = bool(payload.get("is_active"))
    payload["has_data"] = bool(payload.get("has_data"))
    payload["has_train_validation_split"] = bool(payload.get("has_train_validation_split"))
    payload["is_bookmarked"] = bool(payload.get("is_bookmarked"))
    if include_detail:
        workspace_meta = read_json_object(asset_dir(payload["asset_id"]) / "meta.json")
        workspace_payload = workspace_meta.get("payload") if isinstance(workspace_meta.get("payload"), dict) else {}
        payload["owner_email"] = str(
            workspace_payload.get("owner_email") or workspace_meta.get("user_email") or ""
        ).strip() or None
        slide_rows = con.execute(
            """
            SELECT slide_id, file_name, caption, description, sort_order
            FROM ai_asset_slides WHERE asset_id = ? ORDER BY sort_order
            """,
            (payload["asset_id"],),
        ).fetchall()
        payload["slides"] = [
            {**dict(slide), "url": f"/api/assets/catalog/{payload['asset_id']}/slides/{slide['slide_id']}"}
            for slide in slide_rows
        ]
        data_rows = con.execute(
            """
            SELECT data_file_id, data_role, file_name, file_size, content_type
            FROM ai_asset_data_files WHERE asset_id = ? ORDER BY data_role, created_at
            """,
            (payload["asset_id"],),
        ).fetchall()
        payload["data_files"] = [
            {**dict(data_file), "download_url": f"/api/assets/catalog/{payload['asset_id']}/data/{data_file['data_file_id']}"}
            for data_file in data_rows
        ]
        payload["skill_download_url"] = f"/api/assets/catalog/{payload['asset_id']}/skills.zip" if payload.get("skill_zip_path") else None
    return payload


def asset_file_data_uri(path_value: str, asset_id: str) -> str:
    path = (BASE_DIR / path_value).resolve()
    root = asset_dir(asset_id).resolve()
    if not path.is_file() or root not in path.parents:
        return ""
    mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime_type};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def git_clone_error_message(stderr: str) -> str:
    message = (stderr or "").strip()
    lowered = message.lower()
    if any(token in lowered for token in ["authentication failed", "could not read username", "permission denied", "access denied", "publickey"]):
        return "Private repository이거나 접근 권한이 없어 Git을 가져올 수 없습니다. 저장소 권한 또는 인증 정보를 확인하세요."
    if any(token in lowered for token in ["repository not found", "not found", "couldn't find remote ref", "remote branch"]):
        return "저장소 또는 브랜치를 찾을 수 없습니다. Git URL과 브랜치명이 올바른지 확인하세요."
    if any(token in lowered for token in ["could not resolve host", "failed to connect", "connection timed out", "network is unreachable"]):
        return "Git 서버에 연결할 수 없습니다. 네트워크 또는 저장소 주소를 확인하세요."
    if message:
        return f"Git을 가져오지 못했습니다. {message.splitlines()[-1][:180]}"
    return "Git을 가져오지 못했습니다. 저장소 주소와 접근 권한을 확인하세요."


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



# TODO: Remove this sample preset API after AI asset registration QA/testing is complete.
@app.get("/api/assets/sample")
def get_sample_asset(_: Annotated[UserResponse, Depends(get_current_user)]) -> dict:
    meta_path = SAMPLE_ASSET_DIR / "meta.json"
    if not meta_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="샘플 자산 정보를 찾을 수 없습니다.")
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="샘플 자산 정보 형식이 올바르지 않습니다.")
    if not isinstance(meta, dict):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="샘플 자산 정보 형식이 올바르지 않습니다.")
    for slide in meta.get("slides", []):
        if isinstance(slide, dict) and slide.get("stored_name"):
            slide["url"] = f"/api/assets/sample/files/slides/{slide['stored_name']}"
    for data_file in meta.get("data_files", []):
        if isinstance(data_file, dict) and data_file.get("role") and data_file.get("stored_name"):
            data_file["url"] = f"/api/assets/sample/files/data/{data_file['role']}/{data_file['stored_name']}"
    return meta


@app.get("/api/assets/sample/files/{file_path:path}")
def get_sample_asset_file(file_path: str, _: Annotated[UserResponse, Depends(get_current_user)]) -> FileResponse:
    path = (SAMPLE_ASSET_DIR / file_path).resolve()
    sample_root = SAMPLE_ASSET_DIR.resolve()
    if not path.is_file() or sample_root not in path.parents:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="샘플 파일을 찾을 수 없습니다.")
    return FileResponse(path, filename=path.name)


@app.post("/api/assets/repository/clone", response_model=AssetRepositoryCloneResponse)
def clone_ai_asset_repository(
    request: AssetRepositoryCloneRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> AssetRepositoryCloneResponse:
    repo_url = request.repo_url.strip()
    repo_branch = (request.repo_branch or "").strip() or None
    if not re.match(r"^(https?://|ssh://|git@)", repo_url):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Git URL 형식이 올바르지 않습니다. http(s), ssh, git@ 형식의 저장소 주소를 입력하세요.")

    asset_id = validate_asset_id(request.asset_id)
    folder = staging_repo_dir(asset_id)
    with get_connection() as con:
        existing = con.execute("SELECT 1 FROM ai_assets WHERE asset_id = ?", (asset_id,)).fetchone()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 제출된 자산의 저장소는 다시 연결할 수 없습니다.")

    shutil.rmtree(folder, ignore_errors=True)
    command = ["git", "clone", "--depth", "1"]
    if repo_branch:
        command.extend(["--branch", repo_branch, "--single-branch"])
    command.extend([repo_url, str(folder)])
    staging_dir(asset_id).mkdir(parents=True, exist_ok=True)
    try:
        git_env = {**os.environ, "GIT_TERMINAL_PROMPT": "0", "GIT_SSH_COMMAND": "ssh -o BatchMode=yes"}
        result = subprocess.run(command, cwd=BASE_DIR, env=git_env, text=True, capture_output=True, timeout=90, check=False)
    except subprocess.TimeoutExpired:
        shutil.rmtree(folder, ignore_errors=True)
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="Git 저장소를 가져오는 시간이 초과되었습니다. 저장소 크기나 네트워크 상태를 확인하세요.")
    except FileNotFoundError:
        shutil.rmtree(folder, ignore_errors=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="서버에 git 명령어가 설치되어 있지 않습니다.")

    if result.returncode != 0:
        shutil.rmtree(folder, ignore_errors=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=git_clone_error_message(result.stderr))

    return AssetRepositoryCloneResponse(asset_id=asset_id, repo_url=repo_url, repo_branch=repo_branch, tree=list_repository_tree(folder))


@app.post("/api/assets/staging", response_model=AssetStagingResponse)
def stage_ai_asset(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    payload_json: Annotated[str, Form()],
    slides: list[UploadFile] = File(default=[]),
    train_files: list[UploadFile] = File(default=[]),
    validation_files: list[UploadFile] = File(default=[]),
    sample_files: list[UploadFile] = File(default=[]),
) -> AssetStagingResponse:
    try:
        payload = json.loads(payload_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자산 등록 데이터를 해석할 수 없습니다.")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자산 등록 데이터 형식이 올바르지 않습니다.")

    asset_id = validate_asset_id(str(payload.get("asset_id") or "").strip() or None)
    payload["asset_id"] = asset_id
    user_email = str(payload.get("owner_email") or "jongwook.lee@hyundai-wia.com").strip() or "jongwook.lee@hyundai-wia.com"
    payload["user_id"] = current_user.user_id
    payload["user_email"] = user_email
    payload["staged_by"] = current_user.user_id
    now = utc_now()
    payload["staged_at"] = now

    has_train_validation_split = bool(payload.get("has_train_validation_split", False))
    train_uploads = [upload for upload in train_files if upload.filename]
    validation_uploads = [upload for upload in validation_files if upload.filename]
    sample_uploads = [upload for upload in sample_files if upload.filename]
    if len(train_uploads) > 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="학습 샘플 데이터는 1개 파일만 업로드할 수 있습니다. 여러 데이터는 ZIP으로 묶어 업로드하세요.")
    if len(validation_uploads) > 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="검증 샘플 데이터는 1개 파일만 업로드할 수 있습니다. 여러 데이터는 ZIP으로 묶어 업로드하세요.")
    if len(sample_uploads) > 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="샘플 데이터는 1개 파일만 업로드할 수 있습니다. 여러 데이터는 ZIP으로 묶어 업로드하세요.")
    if has_train_validation_split:
        sample_uploads = []
    else:
        train_uploads = []
        validation_uploads = []

    root = staging_dir(asset_id)
    slides_folder = staging_slides_dir(asset_id)
    train_folder = staging_data_dir(asset_id, "train")
    validation_folder = staging_data_dir(asset_id, "validation")
    sample_folder = staging_data_dir(asset_id, "sample")
    root.mkdir(parents=True, exist_ok=True)
    shutil.rmtree(slides_folder, ignore_errors=True)
    shutil.rmtree(root / "data", ignore_errors=True)
    slides_folder.mkdir(parents=True, exist_ok=True)
    if train_uploads:
        train_folder.mkdir(parents=True, exist_ok=True)
    if validation_uploads:
        validation_folder.mkdir(parents=True, exist_ok=True)
    if sample_uploads:
        sample_folder.mkdir(parents=True, exist_ok=True)

    staged_slides: list[dict[str, object]] = []
    staged_data: list[dict[str, object]] = []
    slide_meta = payload.get("slides") if isinstance(payload.get("slides"), list) else []
    for index, upload in enumerate(slides):
        if not upload.filename:
            continue
        if upload.content_type and not upload.content_type.startswith("image/"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자산 활용 화면은 이미지 파일만 업로드할 수 있습니다.")
        original_name = Path(upload.filename).name
        stored_name = safe_upload_filename(original_name, ".png")
        target = slides_folder / stored_name
        with target.open("wb") as out_file:
            shutil.copyfileobj(upload.file, out_file)
        meta = slide_meta[index] if index < len(slide_meta) and isinstance(slide_meta[index], dict) else {}
        staged_slides.append({
            "original_name": original_name,
            "stored_name": stored_name,
            "path": f"staging/assets/{asset_id}/slides/{stored_name}",
            "caption": str(meta.get("caption") or "").strip(),
            "description": str(meta.get("description") or "").strip(),
            "sort_order": index + 1,
            "content_type": upload.content_type,
            "size": target.stat().st_size,
        })

    for role, role_label, uploads, target_folder in (("train", "학습 샘플 데이터", train_uploads, train_folder), ("validation", "검증 샘플 데이터", validation_uploads, validation_folder), ("sample", "샘플 데이터", sample_uploads, sample_folder)):
        for upload in uploads:
            original_name = Path(upload.filename).name
            stored_name = safe_upload_filename(original_name)
            target = target_folder / stored_name
            with target.open("wb") as out_file:
                shutil.copyfileobj(upload.file, out_file)
            size = target.stat().st_size
            if size > MAX_ASSET_DATA_FILE_SIZE:
                target.unlink(missing_ok=True)
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{role_label}는 10MB 이하 파일 1개만 업로드할 수 있습니다. 여러 데이터는 ZIP으로 묶어 업로드하세요.")
            staged_data.append({
                "role": role,
                "original_name": original_name,
                "stored_name": stored_name,
                "path": f"staging/assets/{asset_id}/data/{role}/{stored_name}",
                "size": size,
                "content_type": upload.content_type,
            })

    meta_path = staging_meta_path(asset_id)
    created_at = now
    if meta_path.is_file():
        try:
            existing_meta = json.loads(meta_path.read_text(encoding="utf-8"))
            if isinstance(existing_meta, dict) and existing_meta.get("created_at"):
                created_at = str(existing_meta["created_at"])
        except (json.JSONDecodeError, OSError):
            pass

    meta = {
        "asset_id": asset_id,
        "user_id": current_user.user_id,
        "user_email": user_email,
        "created_at": created_at,
        "updated_at": now,
        "payload": payload,
        "slides": staged_slides,
        "data_files": staged_data,
    }
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    return AssetStagingResponse(asset_id=asset_id, meta_path=f"staging/assets/{asset_id}/meta.json", updated_at=now)


@app.post("/api/assets/{asset_id}/skill-plan", response_model=AssetSkillPlanResponse)
def create_ai_asset_skill_plan(
    asset_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> AssetSkillPlanResponse:
    asset_id = validate_asset_id(asset_id)
    load_staging_meta_for_user(asset_id, current_user)
    try:
        plan = plan_skill_candidates(staging_dir(asset_id), staging_dir(asset_id) / "skills")
    except FileNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Skill 후보 생성 결과를 검증하지 못했습니다. {error}")
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Skill 후보 생성에 실패했습니다. {error}")
    return AssetSkillPlanResponse(
        asset_id=asset_id,
        asset_summary=str(plan.get("asset_summary") or ""),
        reusable_patterns=[str(item) for item in plan.get("reusable_patterns", [])] if isinstance(plan.get("reusable_patterns"), list) else [],
        candidates=plan.get("candidates", []) if isinstance(plan.get("candidates"), list) else [],
        selected_skill_slugs=[str(item) for item in plan.get("selected_skill_slugs", [])] if isinstance(plan.get("selected_skill_slugs"), list) else [],
    )


@app.post("/api/assets/{asset_id}/skills/generate")
def create_ai_asset_skills(
    asset_id: str,
    request: AssetSkillGenerateRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> StreamingResponse:
    asset_id = validate_asset_id(asset_id)
    load_staging_meta_for_user(asset_id, current_user)
    plan_path = staging_dir(asset_id) / "skills" / "skill_plan.json"
    if not plan_path.exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Skill 후보 Planning 결과가 없습니다. 먼저 Skill 자동 생성을 눌러 후보를 생성하세요.")
    try:
        plan = json.loads(plan_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Skill 후보 Planning 결과 형식이 올바르지 않습니다.")

    def stream_events():
        try:
            for event in iter_generate_skill_package(
                staging_dir(asset_id),
                staging_dir(asset_id) / "skills",
                plan,
                request.selected_skill_slugs,
            ):
                if event.get("type") == "completed":
                    event = {**event, "asset_id": asset_id, "generated_at": utc_now()}
                yield json.dumps(event, ensure_ascii=False) + "\n"
        except FileNotFoundError as error:
            yield json.dumps({"type": "error", "message": str(error)}, ensure_ascii=False) + "\n"
        except ValueError as error:
            yield json.dumps({"type": "error", "message": f"Skill 생성 결과를 검증하지 못했습니다. {error}"}, ensure_ascii=False) + "\n"
        except Exception as error:
            yield json.dumps({"type": "error", "message": f"Skill 생성에 실패했습니다. {error}"}, ensure_ascii=False) + "\n"

    return StreamingResponse(
        stream_events(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/assets/intro/summary")
def get_ai_asset_intro_summary(
    _: Annotated[UserResponse, Depends(get_current_user)],
) -> dict[str, Any]:
    with get_connection() as con:
        totals = dict(con.execute(
            """
            SELECT COUNT(*) AS asset_count,
                   COALESCE(SUM(view_count), 0) AS view_count,
                   COALESCE(SUM(diffusion_attempt_count), 0) AS diffusion_attempt_count,
                   COALESCE(SUM(diffusion_completed_count), 0) AS diffusion_completed_count
            FROM ai_assets
            WHERE approval_status = 'approved' AND is_active = 1
            """
        ).fetchone())

        business_distribution = [
            {"label": row["business_area"], "count": row["asset_count"]}
            for row in con.execute(
                """
                SELECT business_area, COUNT(*) AS asset_count
                FROM ai_assets
                WHERE approval_status = 'approved' AND is_active = 1
                GROUP BY business_area
                ORDER BY asset_count DESC, business_area
                """
            ).fetchall()
        ]

        top_assets = []
        for row in con.execute(
            """
            SELECT asset_id, asset_name, description, business_area, maturity_level,
                   tags_json, view_count, diffusion_attempt_count, diffusion_completed_count
            FROM ai_assets
            WHERE approval_status = 'approved' AND is_active = 1
            ORDER BY diffusion_attempt_count DESC, diffusion_completed_count DESC, updated_at DESC
            LIMIT 5
            """
        ).fetchall():
            item = dict(row)
            item["tags"] = load_json_list(item.pop("tags_json", None))
            top_assets.append(item)

        registered_by_month = {
            row["month"]: row["count"]
            for row in con.execute(
                """
                SELECT substr(created_at, 1, 7) AS month, COUNT(*) AS count
                FROM ai_assets
                WHERE approval_status = 'approved' AND is_active = 1
                GROUP BY substr(created_at, 1, 7)
                """
            ).fetchall()
        }
        downloaded_by_month = {
            row["month"]: row["count"]
            for row in con.execute(
                """
                SELECT substr(d.first_attempted_at, 1, 7) AS month, COUNT(*) AS count
                FROM ai_asset_diffusion_attempts d
                JOIN ai_assets a ON a.asset_id = d.asset_id
                WHERE a.approval_status = 'approved' AND a.is_active = 1
                GROUP BY substr(d.first_attempted_at, 1, 7)
                """
            ).fetchall()
        }

    current = datetime.now(timezone.utc)
    month_keys: list[str] = []
    year, month = current.year, current.month
    for offset in range(5, -1, -1):
        target_month = month - offset
        target_year = year
        while target_month <= 0:
            target_month += 12
            target_year -= 1
        month_keys.append(f"{target_year:04d}-{target_month:02d}")

    monthly_activity = [
        {
            "month": key,
            "label": f"{int(key[5:]):02d}월",
            "registrations": int(registered_by_month.get(key, 0)),
            "downloads": int(downloaded_by_month.get(key, 0)),
        }
        for key in month_keys
    ]
    return {
        "totals": totals,
        "business_distribution": business_distribution,
        "monthly_activity": monthly_activity,
        "top_assets": top_assets,
    }


@app.get("/api/assets/catalog")
def list_ai_asset_catalog(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> list[dict[str, Any]]:
    with get_connection() as con:
        rows = con.execute(
            """
            SELECT a.*, u.displayed_name AS owner_name, u.org_name AS owner_org,
                   u.job_title AS owner_job_title,
                   EXISTS(SELECT 1 FROM ai_asset_bookmarks b WHERE b.user_id = ? AND b.asset_id = a.asset_id) AS is_bookmarked
            FROM ai_assets a
            JOIN user u ON u.user_id = a.created_by
            WHERE a.approval_status = 'approved' AND a.is_active = 1
            ORDER BY a.diffusion_attempt_count DESC, a.updated_at DESC
            """,
            (current_user.user_id,),
        ).fetchall()
        return [ai_asset_catalog_payload(con, row) for row in rows]


@app.post("/api/assets/catalog/{asset_id}/bookmark", status_code=status.HTTP_204_NO_CONTENT)
def create_ai_asset_bookmark(
    asset_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> None:
    asset_id = validate_asset_id(asset_id)
    with get_connection() as con:
        asset = con.execute(
            """
            SELECT 1 FROM ai_assets
            WHERE asset_id = ? AND approval_status = 'approved' AND is_active = 1
            """,
            (asset_id,),
        ).fetchone()
        if asset is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="운영 중인 AI 자산을 찾을 수 없습니다.")
        con.execute(
            "INSERT OR IGNORE INTO ai_asset_bookmarks (user_id, asset_id, created_at) VALUES (?, ?, ?)",
            (current_user.user_id, asset_id, utc_now()),
        )


@app.delete("/api/assets/catalog/{asset_id}/bookmark", status_code=status.HTTP_204_NO_CONTENT)
def delete_ai_asset_bookmark(
    asset_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> None:
    asset_id = validate_asset_id(asset_id)
    with get_connection() as con:
        con.execute(
            "DELETE FROM ai_asset_bookmarks WHERE user_id = ? AND asset_id = ?",
            (current_user.user_id, asset_id),
        )


DIFFUSION_CASE_STAGE_LABELS = {
    "poc": "PoC",
    "pilot": "Pilot",
    "production": "운영",
}


def diffusion_case_values(payload: AssetDiffusionCaseRequest) -> dict[str, str | None]:
    values = {
        "title": payload.title.strip(),
        "stage": payload.stage.strip().lower(),
        "applied_work": payload.applied_work.strip(),
        "customization": payload.customization.strip(),
        "effect": payload.effect.strip(),
        "git_url": (payload.git_url or "").strip() or None,
    }
    if any(not values[field] for field in ("title", "applied_work", "customization", "effect")):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="필수 항목을 모두 입력하세요.")
    if values["stage"] not in DIFFUSION_CASE_STAGE_LABELS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="확산 단계가 올바르지 않습니다.")
    return values


def diffusion_case_response(row: sqlite3.Row, current_user_id: str) -> AssetDiffusionCaseResponse:
    value = dict(row)
    value["stage_label"] = DIFFUSION_CASE_STAGE_LABELS.get(value["stage"], value["stage"])
    value["can_edit"] = value["user_id"] == current_user_id
    return AssetDiffusionCaseResponse(**value)


def ensure_catalog_asset(con: sqlite3.Connection, asset_id: str) -> sqlite3.Row:
    row = con.execute(
        """
        SELECT asset_id, diffusion_completed_count
        FROM ai_assets
        WHERE asset_id = ? AND approval_status = 'approved' AND is_active = 1
        """,
        (asset_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="운영 중인 AI 자산을 찾을 수 없습니다.")
    return row


def get_diffusion_case_row(con: sqlite3.Connection, asset_id: str, diffusion_case_id: str) -> sqlite3.Row:
    row = con.execute(
        """
        SELECT c.*, u.displayed_name AS writer_name, u.org_name AS writer_org,
               u.job_title AS writer_job_title
        FROM ai_asset_diffusion_cases c
        JOIN user u ON u.user_id = c.user_id
        WHERE c.asset_id = ? AND c.diffusion_case_id = ?
        """,
        (asset_id, diffusion_case_id),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="확산 사례를 찾을 수 없습니다.")
    return row


@app.get("/api/assets/catalog/{asset_id}/diffusion-cases", response_model=list[AssetDiffusionCaseResponse])
def list_ai_asset_diffusion_cases(
    asset_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> list[AssetDiffusionCaseResponse]:
    asset_id = validate_asset_id(asset_id)
    with get_connection() as con:
        ensure_catalog_asset(con, asset_id)
        rows = con.execute(
            """
            SELECT c.*, u.displayed_name AS writer_name, u.org_name AS writer_org,
                   u.job_title AS writer_job_title
            FROM ai_asset_diffusion_cases c
            JOIN user u ON u.user_id = c.user_id
            WHERE c.asset_id = ?
            ORDER BY c.created_at DESC
            """,
            (asset_id,),
        ).fetchall()
    return [diffusion_case_response(row, current_user.user_id) for row in rows]


@app.post("/api/assets/catalog/{asset_id}/diffusion-cases", response_model=AssetDiffusionCaseMutationResponse, status_code=status.HTTP_201_CREATED)
def create_ai_asset_diffusion_case(
    asset_id: str,
    payload: AssetDiffusionCaseRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> AssetDiffusionCaseMutationResponse:
    asset_id = validate_asset_id(asset_id)
    values = diffusion_case_values(payload)
    diffusion_case_id = str(uuid.uuid4())
    now = utc_now()
    with get_connection() as con:
        ensure_catalog_asset(con, asset_id)
        con.execute(
            """
            INSERT INTO ai_asset_diffusion_cases (
                diffusion_case_id, asset_id, user_id, title, stage, applied_work,
                customization, effect, git_url, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                diffusion_case_id, asset_id, current_user.user_id, values["title"], values["stage"],
                values["applied_work"], values["customization"], values["effect"], values["git_url"], now, now,
            ),
        )
        row = get_diffusion_case_row(con, asset_id, diffusion_case_id)
        count = con.execute(
            "SELECT diffusion_completed_count FROM ai_assets WHERE asset_id = ?",
            (asset_id,),
        ).fetchone()["diffusion_completed_count"]
    return AssetDiffusionCaseMutationResponse(
        case=diffusion_case_response(row, current_user.user_id),
        diffusion_completed_count=count,
    )


@app.put("/api/assets/catalog/{asset_id}/diffusion-cases/{diffusion_case_id}", response_model=AssetDiffusionCaseMutationResponse)
def update_ai_asset_diffusion_case(
    asset_id: str,
    diffusion_case_id: str,
    payload: AssetDiffusionCaseRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> AssetDiffusionCaseMutationResponse:
    asset_id = validate_asset_id(asset_id)
    values = diffusion_case_values(payload)
    now = utc_now()
    with get_connection() as con:
        ensure_catalog_asset(con, asset_id)
        existing = get_diffusion_case_row(con, asset_id, diffusion_case_id)
        if existing["user_id"] != current_user.user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="본인이 작성한 확산 사례만 수정할 수 있습니다.")
        con.execute(
            """
            UPDATE ai_asset_diffusion_cases
            SET title = ?, stage = ?, applied_work = ?, customization = ?,
                effect = ?, git_url = ?, updated_at = ?
            WHERE diffusion_case_id = ? AND asset_id = ?
            """,
            (
                values["title"], values["stage"], values["applied_work"], values["customization"],
                values["effect"], values["git_url"], now, diffusion_case_id, asset_id,
            ),
        )
        row = get_diffusion_case_row(con, asset_id, diffusion_case_id)
        count = con.execute(
            "SELECT diffusion_completed_count FROM ai_assets WHERE asset_id = ?",
            (asset_id,),
        ).fetchone()["diffusion_completed_count"]
    return AssetDiffusionCaseMutationResponse(
        case=diffusion_case_response(row, current_user.user_id),
        diffusion_completed_count=count,
    )


@app.delete("/api/assets/catalog/{asset_id}/diffusion-cases/{diffusion_case_id}", response_model=AssetDiffusionCaseMutationResponse)
def delete_ai_asset_diffusion_case(
    asset_id: str,
    diffusion_case_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> AssetDiffusionCaseMutationResponse:
    asset_id = validate_asset_id(asset_id)
    with get_connection() as con:
        ensure_catalog_asset(con, asset_id)
        existing = get_diffusion_case_row(con, asset_id, diffusion_case_id)
        if existing["user_id"] != current_user.user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="본인이 작성한 확산 사례만 삭제할 수 있습니다.")
        con.execute(
            "DELETE FROM ai_asset_diffusion_cases WHERE diffusion_case_id = ? AND asset_id = ?",
            (diffusion_case_id, asset_id),
        )
        count = con.execute(
            "SELECT diffusion_completed_count FROM ai_assets WHERE asset_id = ?",
            (asset_id,),
        ).fetchone()["diffusion_completed_count"]
    return AssetDiffusionCaseMutationResponse(diffusion_completed_count=count)


def qa_text(value: str, label: str) -> str:
    clean_value = value.strip()
    if not clean_value:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{label}을 입력하세요.")
    return clean_value


def get_qa_post_row(
    con: sqlite3.Connection,
    asset_id: str,
    qa_post_id: str,
    current_user_id: str,
) -> sqlite3.Row:
    row = con.execute(
        """
        SELECT p.*, u.displayed_name AS writer_name, u.org_name AS writer_org,
               u.job_title AS writer_job_title,
               CASE WHEN p.user_id = a.created_by THEN 1 ELSE 0 END AS is_owner,
               CASE WHEN p.user_id = ? THEN 1 ELSE 0 END AS can_edit,
               EXISTS(
                   SELECT 1 FROM ai_asset_qa_helpful h
                   WHERE h.qa_post_id = p.qa_post_id AND h.user_id = ?
               ) AS helpful_by_me
        FROM ai_asset_qa_posts p
        JOIN ai_assets a ON a.asset_id = p.asset_id
        JOIN user u ON u.user_id = p.user_id
        WHERE p.asset_id = ? AND p.qa_post_id = ?
        """,
        (current_user_id, current_user_id, asset_id, qa_post_id),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Q&A 게시물을 찾을 수 없습니다.")
    return row


def qa_reply_response(row: sqlite3.Row) -> AssetQaReplyResponse:
    value = dict(row)
    value["is_owner"] = bool(value.get("is_owner"))
    value["can_edit"] = bool(value.get("can_edit"))
    return AssetQaReplyResponse(**value)


def qa_question_response(
    con: sqlite3.Connection,
    row: sqlite3.Row,
    current_user_id: str,
) -> AssetQaQuestionResponse:
    value = dict(row)
    value["is_owner"] = bool(value.get("is_owner"))
    value["can_edit"] = bool(value.get("can_edit"))
    value["helpful_by_me"] = bool(value.get("helpful_by_me"))
    replies = con.execute(
        """
        SELECT p.*, u.displayed_name AS writer_name, u.org_name AS writer_org,
               u.job_title AS writer_job_title,
               CASE WHEN p.user_id = a.created_by THEN 1 ELSE 0 END AS is_owner,
               CASE WHEN p.user_id = ? THEN 1 ELSE 0 END AS can_edit
        FROM ai_asset_qa_posts p
        JOIN ai_assets a ON a.asset_id = p.asset_id
        JOIN user u ON u.user_id = p.user_id
        WHERE p.parent_post_id = ?
        ORDER BY p.created_at
        """,
        (current_user_id, row["qa_post_id"]),
    ).fetchall()
    value["replies"] = [qa_reply_response(reply) for reply in replies]
    return AssetQaQuestionResponse(**value)


@app.get("/api/assets/catalog/{asset_id}/qa", response_model=list[AssetQaQuestionResponse])
def list_ai_asset_qa(
    asset_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> list[AssetQaQuestionResponse]:
    asset_id = validate_asset_id(asset_id)
    with get_connection() as con:
        ensure_catalog_asset(con, asset_id)
        questions = con.execute(
            """
            SELECT p.*, u.displayed_name AS writer_name, u.org_name AS writer_org,
                   u.job_title AS writer_job_title,
                   CASE WHEN p.user_id = a.created_by THEN 1 ELSE 0 END AS is_owner,
                   CASE WHEN p.user_id = ? THEN 1 ELSE 0 END AS can_edit,
                   EXISTS(
                       SELECT 1 FROM ai_asset_qa_helpful h
                       WHERE h.qa_post_id = p.qa_post_id AND h.user_id = ?
                   ) AS helpful_by_me
            FROM ai_asset_qa_posts p
            JOIN ai_assets a ON a.asset_id = p.asset_id
            JOIN user u ON u.user_id = p.user_id
            WHERE p.asset_id = ? AND p.parent_post_id IS NULL
            ORDER BY p.created_at DESC
            """,
            (current_user.user_id, current_user.user_id, asset_id),
        ).fetchall()
        return [qa_question_response(con, question, current_user.user_id) for question in questions]


@app.post("/api/assets/catalog/{asset_id}/qa/questions", response_model=AssetQaQuestionResponse, status_code=status.HTTP_201_CREATED)
def create_ai_asset_qa_question(
    asset_id: str,
    payload: AssetQaQuestionRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> AssetQaQuestionResponse:
    asset_id = validate_asset_id(asset_id)
    content = qa_text(payload.content, "질문")
    topic = qa_text(payload.topic, "문의 유형")
    qa_post_id = str(uuid.uuid4())
    now = utc_now()
    with get_connection() as con:
        ensure_catalog_asset(con, asset_id)
        con.execute(
            """
            INSERT INTO ai_asset_qa_posts (
                qa_post_id, asset_id, user_id, parent_post_id, topic, content, created_at, updated_at
            ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)
            """,
            (qa_post_id, asset_id, current_user.user_id, topic, content, now, now),
        )
        row = get_qa_post_row(con, asset_id, qa_post_id, current_user.user_id)
        return qa_question_response(con, row, current_user.user_id)


@app.post("/api/assets/catalog/{asset_id}/qa/questions/{question_id}/replies", response_model=AssetQaReplyResponse, status_code=status.HTTP_201_CREATED)
def create_ai_asset_qa_reply(
    asset_id: str,
    question_id: str,
    payload: AssetQaContentRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> AssetQaReplyResponse:
    asset_id = validate_asset_id(asset_id)
    content = qa_text(payload.content, "답글")
    reply_id = str(uuid.uuid4())
    now = utc_now()
    with get_connection() as con:
        ensure_catalog_asset(con, asset_id)
        question = get_qa_post_row(con, asset_id, question_id, current_user.user_id)
        if question["parent_post_id"] is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="질문에만 답글을 작성할 수 있습니다.")
        con.execute(
            """
            INSERT INTO ai_asset_qa_posts (
                qa_post_id, asset_id, user_id, parent_post_id, topic, content, created_at, updated_at
            ) VALUES (?, ?, ?, ?, '', ?, ?, ?)
            """,
            (reply_id, asset_id, current_user.user_id, question_id, content, now, now),
        )
        row = get_qa_post_row(con, asset_id, reply_id, current_user.user_id)
        return qa_reply_response(row)


@app.put(
    "/api/assets/catalog/{asset_id}/qa/posts/{qa_post_id}",
    response_model=AssetQaQuestionResponse | AssetQaReplyResponse,
)
def update_ai_asset_qa_post(
    asset_id: str,
    qa_post_id: str,
    payload: AssetQaContentRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> AssetQaQuestionResponse | AssetQaReplyResponse:
    asset_id = validate_asset_id(asset_id)
    content = qa_text(payload.content, "내용")
    now = utc_now()
    with get_connection() as con:
        ensure_catalog_asset(con, asset_id)
        existing = get_qa_post_row(con, asset_id, qa_post_id, current_user.user_id)
        if existing["user_id"] != current_user.user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="본인이 작성한 게시물만 수정할 수 있습니다.")
        con.execute(
            "UPDATE ai_asset_qa_posts SET content = ?, updated_at = ? WHERE qa_post_id = ? AND asset_id = ?",
            (content, now, qa_post_id, asset_id),
        )
        updated = get_qa_post_row(con, asset_id, qa_post_id, current_user.user_id)
        if updated["parent_post_id"] is None:
            return qa_question_response(con, updated, current_user.user_id)
        return qa_reply_response(updated)


@app.delete("/api/assets/catalog/{asset_id}/qa/posts/{qa_post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ai_asset_qa_post(
    asset_id: str,
    qa_post_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> None:
    asset_id = validate_asset_id(asset_id)
    with get_connection() as con:
        ensure_catalog_asset(con, asset_id)
        existing = get_qa_post_row(con, asset_id, qa_post_id, current_user.user_id)
        if existing["user_id"] != current_user.user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="본인이 작성한 게시물만 삭제할 수 있습니다.")
        con.execute(
            "DELETE FROM ai_asset_qa_posts WHERE qa_post_id = ? AND asset_id = ?",
            (qa_post_id, asset_id),
        )


@app.post("/api/assets/catalog/{asset_id}/qa/questions/{question_id}/helpful", response_model=AssetQaHelpfulResponse)
def create_ai_asset_qa_helpful(
    asset_id: str,
    question_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> AssetQaHelpfulResponse:
    asset_id = validate_asset_id(asset_id)
    with get_connection() as con:
        ensure_catalog_asset(con, asset_id)
        question = get_qa_post_row(con, asset_id, question_id, current_user.user_id)
        if question["parent_post_id"] is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="질문에만 도움돼요를 표시할 수 있습니다.")
        con.execute(
            "INSERT OR IGNORE INTO ai_asset_qa_helpful (qa_post_id, user_id, created_at) VALUES (?, ?, ?)",
            (question_id, current_user.user_id, utc_now()),
        )
        count = con.execute(
            "SELECT helpful_count FROM ai_asset_qa_posts WHERE qa_post_id = ?",
            (question_id,),
        ).fetchone()["helpful_count"]
    return AssetQaHelpfulResponse(helpful_count=count, helpful_by_me=True)


@app.delete("/api/assets/catalog/{asset_id}/qa/questions/{question_id}/helpful", response_model=AssetQaHelpfulResponse)
def delete_ai_asset_qa_helpful(
    asset_id: str,
    question_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> AssetQaHelpfulResponse:
    asset_id = validate_asset_id(asset_id)
    with get_connection() as con:
        ensure_catalog_asset(con, asset_id)
        question = get_qa_post_row(con, asset_id, question_id, current_user.user_id)
        if question["parent_post_id"] is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="질문에만 도움돼요를 표시할 수 있습니다.")
        con.execute(
            "DELETE FROM ai_asset_qa_helpful WHERE qa_post_id = ? AND user_id = ?",
            (question_id, current_user.user_id),
        )
        count = con.execute(
            "SELECT helpful_count FROM ai_asset_qa_posts WHERE qa_post_id = ?",
            (question_id,),
        ).fetchone()["helpful_count"]
    return AssetQaHelpfulResponse(helpful_count=count, helpful_by_me=False)


@app.get("/api/assets/catalog/{asset_id}")
def get_ai_asset_catalog_detail(
    asset_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> dict[str, Any]:
    asset_id = validate_asset_id(asset_id)
    with get_connection() as con:
        updated = con.execute(
            """
            UPDATE ai_assets SET view_count = view_count + 1
            WHERE asset_id = ? AND approval_status = 'approved' AND is_active = 1
            """,
            (asset_id,),
        )
        if updated.rowcount == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="운영 중인 AI 자산을 찾을 수 없습니다.")
        row = con.execute(
            """
            SELECT a.*, u.displayed_name AS owner_name, u.org_name AS owner_org,
                   u.job_title AS owner_job_title,
                   EXISTS(SELECT 1 FROM ai_asset_bookmarks b WHERE b.user_id = ? AND b.asset_id = a.asset_id) AS is_bookmarked
            FROM ai_assets a
            JOIN user u ON u.user_id = a.created_by
            WHERE a.asset_id = ?
            """,
            (current_user.user_id, asset_id),
        ).fetchone()
        return ai_asset_catalog_payload(con, row, include_detail=True)


def catalog_asset_file(con: sqlite3.Connection, asset_id: str, table: str, id_column: str, file_id: str) -> sqlite3.Row:
    row = con.execute(
        f"""
        SELECT f.file_path, f.file_name
        FROM {table} f
        JOIN ai_assets a ON a.asset_id = f.asset_id
        WHERE f.{id_column} = ? AND f.asset_id = ?
          AND a.approval_status = 'approved' AND a.is_active = 1
        """,
        (file_id, asset_id),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="자산 파일을 찾을 수 없습니다.")
    path = (BASE_DIR / row["file_path"]).resolve()
    if not path.is_file() or asset_dir(asset_id).resolve() not in path.parents:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="자산 파일을 찾을 수 없습니다.")
    return row


@app.get("/api/assets/catalog/{asset_id}/slides/{slide_id}")
def get_ai_asset_catalog_slide(
    asset_id: str,
    slide_id: str,
) -> FileResponse:
    asset_id = validate_asset_id(asset_id)
    with get_connection() as con:
        row = catalog_asset_file(con, asset_id, "ai_asset_slides", "slide_id", slide_id)
    return FileResponse(BASE_DIR / row["file_path"], media_type=mimetypes.guess_type(row["file_name"])[0])


@app.get("/api/assets/catalog/{asset_id}/data/{data_file_id}")
def download_ai_asset_catalog_data(
    asset_id: str,
    data_file_id: str,
    _: Annotated[UserResponse, Depends(get_current_user)],
) -> FileResponse:
    asset_id = validate_asset_id(asset_id)
    with get_connection() as con:
        row = catalog_asset_file(con, asset_id, "ai_asset_data_files", "data_file_id", data_file_id)
    return FileResponse(BASE_DIR / row["file_path"], filename=row["file_name"])


@app.get("/api/assets/catalog/{asset_id}/skills.zip")
def download_ai_asset_catalog_skills(
    asset_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> FileResponse:
    asset_id = validate_asset_id(asset_id)
    with get_connection() as con:
        row = con.execute(
            """
            SELECT skill_zip_path, asset_name FROM ai_assets
            WHERE asset_id = ? AND approval_status = 'approved' AND is_active = 1
            """,
            (asset_id,),
        ).fetchone()
        if row is None or not row["skill_zip_path"]:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="확산 패키지를 찾을 수 없습니다.")
        path = (BASE_DIR / row["skill_zip_path"]).resolve()
        if not path.is_file() or asset_dir(asset_id).resolve() not in path.parents:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="확산 패키지를 찾을 수 없습니다.")
        con.execute(
            """
            INSERT OR IGNORE INTO ai_asset_diffusion_attempts (asset_id, user_id, first_attempted_at)
            VALUES (?, ?, ?)
            """,
            (asset_id, current_user.user_id, utc_now()),
        )
        attempt_count = con.execute(
            "SELECT diffusion_attempt_count FROM ai_assets WHERE asset_id = ?",
            (asset_id,),
        ).fetchone()["diffusion_attempt_count"]
    safe_name = re.sub(r"[^0-9A-Za-z가-힣._-]+", "_", row["asset_name"]).strip("_") or "ai_asset"
    return FileResponse(
        path,
        filename=f"{safe_name}_skills.zip",
        media_type="application/zip",
        headers={"X-Diffusion-Attempt-Count": str(attempt_count)},
    )


@app.get("/api/assets/mine", response_model=list[AiAssetResponse])
def list_my_ai_assets(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> list[AiAssetResponse]:
    with get_connection() as con:
        rows = con.execute(
            """
            SELECT asset_id, asset_name, description, business_area, maturity_level,
                   approval_status, is_active, view_count, diffusion_attempt_count, diffusion_completed_count,
                   created_by, created_at, updated_at, reviewed_at, review_comment
            FROM ai_assets
            WHERE created_by = ?
            ORDER BY submitted_at DESC, created_at DESC
            """,
            (current_user.user_id,),
        ).fetchall()
    return [AiAssetResponse(**dict(row)) for row in rows]


@app.get("/api/admin/assets", response_model=list[AiAssetResponse])
def list_admin_ai_assets(
    _: Annotated[UserResponse, Depends(require_admin)],
) -> list[AiAssetResponse]:
    with get_connection() as con:
        rows = con.execute(
            """
            SELECT a.asset_id, a.asset_name, a.description, a.business_area, a.maturity_level,
                   a.approval_status, a.is_active, a.view_count, a.diffusion_attempt_count, a.diffusion_completed_count,
                   a.created_by, u.displayed_name AS owner_name, u.org_name AS owner_org,
                   u.job_title AS owner_job_title, a.created_at, a.updated_at, a.submitted_at,
                   a.reviewed_at, a.reviewed_by, a.review_comment
            FROM ai_assets a
            JOIN user u ON u.user_id = a.created_by
            ORDER BY COALESCE(a.submitted_at, a.created_at) DESC
            """
        ).fetchall()
    return [AiAssetResponse(**dict(row)) for row in rows]


@app.put("/api/admin/assets/{asset_id}/status", response_model=AiAssetResponse)
def update_admin_ai_asset_status(
    asset_id: str,
    payload: AssetStatusUpdateRequest,
    current_user: Annotated[UserResponse, Depends(require_admin)],
) -> AiAssetResponse:
    asset_id = validate_asset_id(asset_id)
    clean_status = payload.status.strip().lower()
    clean_comment = payload.review_comment.strip()
    if clean_status not in {"approved", "rejected"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Approve 또는 Reject를 선택하세요.")
    if not clean_comment:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="심사 메시지를 입력하세요.")

    now = utc_now()
    with get_connection() as con:
        result = con.execute(
            """
            UPDATE ai_assets
            SET approval_status = ?, updated_at = ?, reviewed_at = ?, reviewed_by = ?, review_comment = ?
            WHERE asset_id = ? AND approval_status = ?
            """,
            (clean_status, now, now, current_user.user_id, clean_comment, asset_id, "submitted"),
        )
        if result.rowcount == 0:
            existing = con.execute("SELECT approval_status FROM ai_assets WHERE asset_id = ?", (asset_id,)).fetchone()
            if existing is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI 자산을 찾을 수 없습니다.")
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 심사가 완료된 AI 자산입니다.")
        row = con.execute(
            """
            SELECT a.asset_id, a.asset_name, a.description, a.business_area, a.maturity_level,
                   a.approval_status, a.is_active, a.view_count, a.diffusion_attempt_count, a.diffusion_completed_count,
                   a.created_by, u.displayed_name AS owner_name, u.org_name AS owner_org,
                   u.job_title AS owner_job_title, a.created_at, a.updated_at, a.submitted_at,
                   a.reviewed_at, a.reviewed_by, a.review_comment
            FROM ai_assets a
            JOIN user u ON u.user_id = a.created_by
            WHERE a.asset_id = ?
            """,
            (asset_id,),
        ).fetchone()
    return AiAssetResponse(**dict(row))


@app.put("/api/admin/assets/{asset_id}/activation", response_model=AiAssetResponse)
def update_admin_ai_asset_activation(
    asset_id: str,
    payload: AssetActivationRequest,
    _: Annotated[UserResponse, Depends(require_admin)],
) -> AiAssetResponse:
    asset_id = validate_asset_id(asset_id)
    now = utc_now()
    with get_connection() as con:
        result = con.execute(
            """
            UPDATE ai_assets
            SET is_active = ?, updated_at = ?
            WHERE asset_id = ? AND approval_status = ?
            """,
            (1 if payload.is_active else 0, now, asset_id, "approved"),
        )
        if result.rowcount == 0:
            existing = con.execute("SELECT approval_status FROM ai_assets WHERE asset_id = ?", (asset_id,)).fetchone()
            if existing is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI 자산을 찾을 수 없습니다.")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="승인된 운영 자산만 활성 상태를 변경할 수 있습니다.")
        row = con.execute(
            """
            SELECT a.asset_id, a.asset_name, a.description, a.business_area, a.maturity_level,
                   a.approval_status, a.is_active, a.view_count, a.diffusion_attempt_count, a.diffusion_completed_count,
                   a.created_by, u.displayed_name AS owner_name, u.org_name AS owner_org,
                   u.job_title AS owner_job_title, a.created_at, a.updated_at, a.submitted_at,
                   a.reviewed_at, a.reviewed_by, a.review_comment
            FROM ai_assets a
            JOIN user u ON u.user_id = a.created_by
            WHERE a.asset_id = ?
            """,
            (asset_id,),
        ).fetchone()
    return AiAssetResponse(**dict(row))


@app.delete("/api/admin/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_ai_asset(
    asset_id: str,
    _: Annotated[UserResponse, Depends(require_admin)],
) -> None:
    asset_id = validate_asset_id(asset_id)
    with get_connection() as con:
        row = con.execute(
            "SELECT approval_status FROM ai_assets WHERE asset_id = ?",
            (asset_id,),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI 자산을 찾을 수 없습니다.")
        if row["approval_status"] not in {"approved", "rejected"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="승인 또는 반려된 자산만 삭제할 수 있습니다.")
        con.execute("DELETE FROM ai_assets WHERE asset_id = ?", (asset_id,))

    try:
        shutil.rmtree(asset_dir(asset_id), ignore_errors=False)
    except FileNotFoundError:
        pass
    except OSError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"자산 정보는 삭제되었지만 workspace 파일을 제거하지 못했습니다: {error}",
        )


@app.get("/api/assets/{asset_id}/registration-document", response_class=HTMLResponse)
def get_ai_asset_registration_document(
    asset_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> HTMLResponse:
    asset_id = validate_asset_id(asset_id)
    with get_connection() as con:
        asset_row = con.execute(
            """
            SELECT a.*, u.displayed_name AS owner_name, u.org_name AS owner_org,
                   u.job_title AS owner_job_title
            FROM ai_assets a
            JOIN user u ON u.user_id = a.created_by
            WHERE a.asset_id = ?
            """,
            (asset_id,),
        ).fetchone()
        if asset_row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI 자산을 찾을 수 없습니다.")
        if asset_row["created_by"] != current_user.user_id and not current_user.is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="이 자산 등록서를 조회할 권한이 없습니다.")
        slide_rows = con.execute(
            """
            SELECT file_name, file_path, caption, description, sort_order
            FROM ai_asset_slides WHERE asset_id = ? ORDER BY sort_order
            """,
            (asset_id,),
        ).fetchall()
        data_rows = con.execute(
            """
            SELECT data_role, file_name, file_path, file_size, content_type
            FROM ai_asset_data_files WHERE asset_id = ? ORDER BY data_role, created_at
            """,
            (asset_id,),
        ).fetchall()
        skill_rows = con.execute(
            """
            SELECT file_path, content, updated_at
            FROM ai_asset_skill_files WHERE asset_id = ? ORDER BY file_path
            """,
            (asset_id,),
        ).fetchall()

    asset = dict(asset_row)
    for field in ("task_types_json", "implementation_types_json", "tags_json", "models_json", "tech_stacks_json", "before_after_metrics_json", "performance_metrics_json"):
        try:
            asset[field.removesuffix("_json")] = json.loads(asset.get(field) or "[]")
        except json.JSONDecodeError:
            asset[field.removesuffix("_json")] = []
        asset.pop(field, None)

    workspace_meta_path = asset_dir(asset_id) / "meta.json"
    meta = read_json_object(workspace_meta_path)
    if not meta:
        meta = {"asset_id": asset_id, "payload": asset}

    repo_tree_path = asset_dir(asset_id) / "repo_tree.json"
    repo_tree_value = read_json_object(repo_tree_path).get("tree", [])
    if not isinstance(repo_tree_value, list):
        repo_tree_value = []

    slides = []
    for row in slide_rows:
        item = dict(row)
        item["data_uri"] = asset_file_data_uri(item["file_path"], asset_id)
        slides.append(item)

    skill_files = []
    workspace_skills = asset_skills_dir(asset_id)
    if workspace_skills.is_dir():
        for file_path in sorted(path for path in workspace_skills.rglob("*") if path.is_file()):
            if file_path.name == "skill.zip":
                continue
            try:
                content = file_path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                content = "[Binary file]"
            skill_files.append({
                "file_path": file_path.relative_to(workspace_skills).as_posix(),
                "content": content,
                "updated_at": asset.get("skill_generated_at"),
            })

    if not skill_files:
        skill_files = [dict(row) for row in skill_rows]

    skill_zip = asset_dir(asset_id) / "skill.zip"
    legacy_skill_zip = asset_skills_dir(asset_id) / "skill.zip"
    if not skill_files and not skill_zip.is_file() and legacy_skill_zip.is_file():
        skill_zip = legacy_skill_zip
    if not skill_files and skill_zip.is_file():
        import zipfile
        with zipfile.ZipFile(skill_zip) as archive:
            for name in sorted(archive.namelist()):
                if name.endswith("/"):
                    continue
                try:
                    content = archive.read(name).decode("utf-8")
                except UnicodeDecodeError:
                    content = "[Binary file]"
                skill_files.append({"file_path": name, "content": content, "updated_at": asset.get("skill_generated_at")})

    document_data = {
        "asset": asset,
        "meta": meta,
        "data_files": [dict(row) for row in data_rows],
        "slides": slides,
        "repo_tree": repo_tree_value,
        "skill_files": skill_files,
    }
    if not ASSET_REGISTRATION_TEMPLATE.is_file():
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="자산 등록서 HTML 템플릿을 찾을 수 없습니다.")
    serialized = json.dumps(document_data, ensure_ascii=False).replace("</", r"<\/")
    html_document = ASSET_REGISTRATION_TEMPLATE.read_text(encoding="utf-8").replace("__ASSET_DATA_JSON__", serialized)
    return HTMLResponse(content=html_document, headers={"Cache-Control": "no-store"})

@app.post("/api/assets", response_model=AiAssetResponse, status_code=status.HTTP_201_CREATED)
def create_ai_asset(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
    payload_json: Annotated[str, Form()],
    slides: list[UploadFile] = File(default=[]),
    train_files: list[UploadFile] = File(default=[]),
    validation_files: list[UploadFile] = File(default=[]),
    sample_files: list[UploadFile] = File(default=[]),
) -> AiAssetResponse:
    try:
        payload = json.loads(payload_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자산 등록 데이터를 해석할 수 없습니다.")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자산 등록 데이터 형식이 올바르지 않습니다.")

    asset_name = require_text(payload, "asset_name", "자산명")
    description = require_text(payload, "description", "설명")
    business_area = require_text(payload, "business_area", "업무 영역")
    maturity_level = require_text(payload, "maturity_level", "자산 성숙도")
    problem_definition = require_text(payload, "problem_definition", "문제 정의")
    as_is_workflow = require_text(payload, "as_is_workflow", "As-Is Workflow")
    to_be_workflow = require_text(payload, "to_be_workflow", "To-Be Workflow")
    ai_effect = require_text(payload, "ai_effect", "AI 개선 효과")

    task_types = payload.get("task_types") if isinstance(payload.get("task_types"), list) else []
    implementation_types = payload.get("implementation_types") if isinstance(payload.get("implementation_types"), list) else []
    if not task_types:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task 유형을 1개 이상 선택하세요.")
    if not implementation_types:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="구현 방식을 1개 이상 선택하세요.")

    has_data = bool(payload.get("has_data", True))
    data_type = str(payload.get("data_type") or "").strip() or None
    data_description = str(payload.get("data_description") or "").strip() or None
    if has_data and not data_type:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Data 유형을 선택하세요.")

    has_train_validation_split = bool(payload.get("has_train_validation_split", False))
    train_uploads = [upload for upload in train_files if upload.filename]
    validation_uploads = [upload for upload in validation_files if upload.filename]
    sample_uploads = [upload for upload in sample_files if upload.filename]
    if len(train_uploads) > 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="학습 샘플 데이터는 1개 파일만 업로드할 수 있습니다. 여러 데이터는 ZIP으로 묶어 업로드하세요.")
    if len(validation_uploads) > 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="검증 샘플 데이터는 1개 파일만 업로드할 수 있습니다. 여러 데이터는 ZIP으로 묶어 업로드하세요.")
    if len(sample_uploads) > 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="샘플 데이터는 1개 파일만 업로드할 수 있습니다. 여러 데이터는 ZIP으로 묶어 업로드하세요.")
    if has_train_validation_split:
        sample_uploads = []
    else:
        train_uploads = []
        validation_uploads = []

    asset_id = validate_asset_id(str(payload.get("asset_id") or "").strip() or None)
    with get_connection() as con:
        existing = con.execute("SELECT 1 FROM ai_assets WHERE asset_id = ?", (asset_id,)).fetchone()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 제출된 자산입니다.")
    folder = asset_dir(asset_id)
    slides_folder = asset_slides_dir(asset_id)
    skills_folder = asset_skills_dir(asset_id)
    train_folder = asset_data_dir(asset_id, "train")
    validation_folder = asset_data_dir(asset_id, "validation")
    sample_folder = asset_data_dir(asset_id, "sample")
    folder.mkdir(parents=True, exist_ok=True)
    slides_folder.mkdir(parents=True, exist_ok=True)
    skills_folder.mkdir(parents=True, exist_ok=True)
    if train_uploads:
        train_folder.mkdir(parents=True, exist_ok=True)
    if validation_uploads:
        validation_folder.mkdir(parents=True, exist_ok=True)
    if sample_uploads:
        sample_folder.mkdir(parents=True, exist_ok=True)

    now = utc_now()
    slide_rows: list[tuple[str, str, str, str, str, str, int, str]] = []
    data_rows: list[tuple[str, str, str, str, str, int, str | None, str]] = []
    skill_rows: list[tuple[str, str, str, str, str, str]] = []
    try:
        slide_meta = payload.get("slides") if isinstance(payload.get("slides"), list) else []
        for index, upload in enumerate(slides):
            if not upload.filename:
                continue
            if upload.content_type and not upload.content_type.startswith("image/"):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="적용 이미지는 이미지 파일만 업로드할 수 있습니다.")
            slide_id = str(uuid.uuid4())
            original_name = Path(upload.filename).name
            stored_name = safe_upload_filename(original_name, ".png")
            target = slides_folder / stored_name
            with target.open("wb") as out_file:
                shutil.copyfileobj(upload.file, out_file)
            meta = slide_meta[index] if index < len(slide_meta) and isinstance(slide_meta[index], dict) else {}
            rel_path = f"workspace/assets/{asset_id}/slides/{stored_name}"
            slide_rows.append((slide_id, asset_id, original_name, rel_path, str(meta.get("caption") or "").strip(), str(meta.get("description") or "").strip(), index + 1, now))

        for role, role_label, uploads, target_folder in (("train", "학습 샘플 데이터", train_uploads, train_folder), ("validation", "검증 샘플 데이터", validation_uploads, validation_folder), ("sample", "샘플 데이터", sample_uploads, sample_folder)):
            for upload in uploads:
                data_file_id = str(uuid.uuid4())
                original_name = Path(upload.filename).name
                stored_name = safe_upload_filename(original_name)
                target = target_folder / stored_name
                with target.open("wb") as out_file:
                    shutil.copyfileobj(upload.file, out_file)
                size = target.stat().st_size
                if size > MAX_ASSET_DATA_FILE_SIZE:
                    target.unlink(missing_ok=True)
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{role_label}는 10MB 이하 파일 1개만 업로드할 수 있습니다. 여러 데이터는 ZIP으로 묶어 업로드하세요.")
                rel_path = f"workspace/assets/{asset_id}/data/{role}/{stored_name}"
                data_rows.append((data_file_id, asset_id, role, original_name, rel_path, size, upload.content_type, now))

        skill_files = payload.get("skill_files") if isinstance(payload.get("skill_files"), list) else []
        for item in skill_files:
            if not isinstance(item, dict):
                continue
            file_path = str(item.get("path") or "").strip()
            content = str(item.get("content") or "")
            if not file_path:
                continue
            skill_rows.append((str(uuid.uuid4()), asset_id, file_path, content, now, now))

        if skill_rows:
            import zipfile
            zip_path = folder / "skill.zip"
            with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                for _, _, file_path, content, _, _ in skill_rows:
                    zf.writestr(file_path, content)
            skill_status = "created"
            skill_zip_path = f"workspace/assets/{asset_id}/skill.zip"
            skill_generated_at = now
        else:
            skill_status = "not_created"
            skill_zip_path = None
            skill_generated_at = None

        registration_meta = read_json_object(staging_meta_path(asset_id))
        registration_meta.update({
            "asset_id": asset_id,
            "user_id": current_user.user_id,
            "submitted_at": now,
            "payload": {key: value for key, value in payload.items() if key != "skill_files"},
        })
        (folder / "meta.json").write_text(json.dumps(registration_meta, ensure_ascii=False, indent=2), encoding="utf-8")
        repo_tree = repository_tree_payload(staging_repo_dir(asset_id)) if staging_repo_dir(asset_id).is_dir() else []
        (folder / "repo_tree.json").write_text(json.dumps({"tree": repo_tree}, ensure_ascii=False, indent=2), encoding="utf-8")

        with get_connection() as con:
            con.execute(
                """
                INSERT INTO ai_assets (
                    asset_id, asset_name, description, business_area, maturity_level,
                    task_types_json, implementation_types_json, tags_json,
                    problem_definition, as_is_workflow, to_be_workflow, ai_effect,
                    has_data, has_train_validation_split, data_type, data_description,
                    models_json, tech_stacks_json, before_after_metrics_json, performance_metrics_json,
                    repo_url, repo_branch, skill_status, skill_zip_path, diffusion_prompt, skill_generated_at,
                    approval_status, created_by, created_at, updated_at, submitted_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?, ?)
                """,
                (
                    asset_id,
                    asset_name,
                    description,
                    business_area,
                    maturity_level,
                    json_text(task_types),
                    json_text(implementation_types),
                    json_text(payload.get("tags") if isinstance(payload.get("tags"), list) else []),
                    problem_definition,
                    as_is_workflow,
                    to_be_workflow,
                    ai_effect,
                    1 if has_data else 0,
                    1 if has_train_validation_split else 0,
                    data_type,
                    data_description,
                    json_text(payload.get("models") if isinstance(payload.get("models"), list) else []),
                    json_text(payload.get("tech_stacks") if isinstance(payload.get("tech_stacks"), list) else []),
                    json_text(payload.get("before_after_metrics") if isinstance(payload.get("before_after_metrics"), list) else []),
                    json_text(payload.get("performance_metrics") if isinstance(payload.get("performance_metrics"), list) else []),
                    str(payload.get("repo_url") or "").strip() or None,
                    str(payload.get("repo_branch") or "").strip() or None,
                    skill_status,
                    skill_zip_path,
                    str(payload.get("diffusion_prompt") or "").strip() or None,
                    skill_generated_at,
                    current_user.user_id,
                    now,
                    now,
                    now,
                ),
            )
            con.executemany(
                """
                INSERT INTO ai_asset_slides (slide_id, asset_id, file_name, file_path, caption, description, sort_order, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                slide_rows,
            )
            con.executemany(
                """
                INSERT INTO ai_asset_data_files (data_file_id, asset_id, data_role, file_name, file_path, file_size, content_type, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                data_rows,
            )
            con.executemany(
                """
                INSERT INTO ai_asset_skill_files (skill_file_id, asset_id, file_path, content, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                skill_rows,
            )
            row = con.execute(
                """
                SELECT asset_id, asset_name, description, business_area, maturity_level,
                       approval_status, is_active, view_count, diffusion_attempt_count, diffusion_completed_count,
                       created_by, created_at, updated_at
                FROM ai_assets
                WHERE asset_id = ?
                """,
                (asset_id,),
            ).fetchone()
            response = AiAssetResponse(**dict(row))
        finalize_submitted_asset_storage(asset_id)
        return response
    except Exception:
        with get_connection() as cleanup_con:
            cleanup_con.execute("DELETE FROM ai_assets WHERE asset_id = ?", (asset_id,))
        shutil.rmtree(folder, ignore_errors=True)
        raise

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


@app.post("/api/dx-discovery/chat", response_model=DxDiscoveryChatResponse)
def chat_dx_discovery(
    payload: DxDiscoveryChatRequest,
    _: Annotated[UserResponse, Depends(get_current_user)],
) -> DxDiscoveryChatResponse:
    return run_dx_agent(payload.messages)


@app.get("/api/dx-discovery/sessions", response_model=list[DxDiscoverySessionResponse])
def list_dx_discovery_sessions(current_user: Annotated[UserResponse, Depends(get_current_user)]) -> list[DxDiscoverySessionResponse]:
    with get_connection() as con:
        rows = con.execute(
            """
            SELECT session_id, user_id, title, status, fields_json, recommended_data_ids_json,
                   recommended_asset_ids_json, created_at, updated_at, completed_at
            FROM dx_discovery_sessions
            WHERE user_id = ?
            ORDER BY updated_at DESC
            """,
            (current_user.user_id,),
        ).fetchall()
        return [dx_session_from_row(row) for row in rows]


@app.post("/api/dx-discovery/sessions", response_model=DxDiscoverySessionCreateResponse, status_code=status.HTTP_201_CREATED)
def create_dx_discovery_session(current_user: Annotated[UserResponse, Depends(get_current_user)]) -> DxDiscoverySessionCreateResponse:
    now = utc_now()
    session_id = str(uuid.uuid4())
    with get_connection() as con:
        con.execute(
            """
            INSERT INTO dx_discovery_sessions (
                session_id, user_id, title, status, fields_json, recommended_data_ids_json,
                recommended_asset_ids_json, created_at, updated_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
            """,
            (session_id, current_user.user_id, DX_DEFAULT_TITLE, DX_IN_PROGRESS_STATUS, "{}", "[]", "[]", now, now),
        )
        row = fetch_dx_session(con, session_id, current_user.user_id)
        session = dx_session_from_row(row)
        return DxDiscoverySessionCreateResponse(**session.model_dump(), messages=[])


@app.get("/api/dx-discovery/sessions/{session_id}", response_model=DxDiscoverySessionDetailResponse)
def get_dx_discovery_session(
    session_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> DxDiscoverySessionDetailResponse:
    with get_connection() as con:
        row = fetch_dx_session(con, session_id, current_user.user_id)
        session = dx_session_from_row(row)
        return DxDiscoverySessionDetailResponse(**session.model_dump(), messages=fetch_dx_messages(con, session_id))


@app.delete("/api/dx-discovery/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dx_discovery_session(
    session_id: str,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> None:
    with get_connection() as con:
        result = con.execute(
            "DELETE FROM dx_discovery_sessions WHERE session_id = ? AND user_id = ?",
            (session_id, current_user.user_id),
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DX 과제 발굴 세션을 찾을 수 없습니다.")


@app.post("/api/dx-discovery/sessions/{session_id}/chat", response_model=DxDiscoverySessionDetailResponse)
def chat_dx_discovery_session(
    session_id: str,
    payload: DxDiscoveryChatRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> DxDiscoverySessionDetailResponse:
    user_message = next((message for message in reversed(payload.messages) if message.role == "user" and message.text.strip()), None)
    if user_message is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="사용자 메시지를 입력하세요.")

    now = utc_now()
    with get_connection() as con:
        session_row = fetch_dx_session(con, session_id, current_user.user_id)
        seq = next_dx_message_seq(con, session_id)
        con.execute(
            """
            INSERT INTO dx_discovery_messages (message_id, session_id, role, content, seq, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), session_id, "user", user_message.text.strip(), seq, now),
        )
        history_rows = con.execute(
            """
            SELECT role, content
            FROM dx_discovery_messages
            WHERE session_id = ?
            ORDER BY seq ASC
            """,
            (session_id,),
        ).fetchall()
        history = [DxChatMessage(role=row["role"], text=row["content"]) for row in history_rows]

    agent_response = run_dx_agent(history)
    agent_message_time = utc_now()
    existing_fields = normalize_dx_fields(load_json_value(session_row["fields_json"], {}))
    merged_fields = merge_dx_fields(existing_fields, agent_response.fields)
    project_title = str(merged_fields.get("project_title") or "").strip()
    next_status = DX_COMPLETE_STATUS if agent_response.is_complete and project_title else DX_IN_PROGRESS_STATUS
    next_title = project_title if project_title else DX_DEFAULT_TITLE
    completed_at = agent_message_time if next_status == DX_COMPLETE_STATUS else None

    with get_connection() as con:
        seq = next_dx_message_seq(con, session_id)
        con.execute(
            """
            INSERT INTO dx_discovery_messages (message_id, session_id, role, content, seq, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), session_id, "agent", agent_response.reply, seq, agent_message_time),
        )
        con.execute(
            """
            UPDATE dx_discovery_sessions
            SET title = ?, status = ?, fields_json = ?, updated_at = ?, completed_at = ?
            WHERE session_id = ? AND user_id = ?
            """,
            (
                next_title,
                next_status,
                json.dumps(merged_fields, ensure_ascii=False),
                agent_message_time,
                completed_at,
                session_id,
                current_user.user_id,
            ),
        )
        row = fetch_dx_session(con, session_id, current_user.user_id)
        session = dx_session_from_row(row)
        return DxDiscoverySessionDetailResponse(**session.model_dump(), messages=fetch_dx_messages(con, session_id))


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
    folder.mkdir(parents=True, exist_ok=True)
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
    folder.mkdir(parents=True, exist_ok=True)
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
    folder.mkdir(parents=True, exist_ok=True)
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

