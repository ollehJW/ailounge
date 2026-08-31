CREATE SCHEMA IF NOT EXISTS ai_lounge AUTHORIZATION CURRENT_USER;
SET search_path TO ai_lounge, public;

CREATE TABLE IF NOT EXISTS "user" (
    user_id TEXT PRIMARY KEY,
    login_id TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    org_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    displayed_name TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
    created_at TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_login_id ON "user"(login_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email ON "user"(email) WHERE email <> '';

CREATE TABLE IF NOT EXISTS user_sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    CONSTRAINT fk_user_sessions_user
        FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS news (
    news_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    writer TEXT NOT NULL,
    cover_image TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    view_count INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'external',
    source_url TEXT,
    org_name TEXT,
    CONSTRAINT fk_news_writer
        FOREIGN KEY (writer) REFERENCES "user"(user_id) ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_news_created_at ON news(created_at);
CREATE INDEX IF NOT EXISTS idx_news_category_created_at ON news(category, created_at);

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
    CONSTRAINT fk_ai_usage_posts_user
        FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS ai_usage_post_likes (
    usage_post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (usage_post_id, user_id),
    CONSTRAINT fk_ai_usage_post_likes_post
        FOREIGN KEY (usage_post_id) REFERENCES ai_usage_posts(usage_post_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT fk_ai_usage_post_likes_user
        FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_posts_created_at ON ai_usage_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_posts_like_count ON ai_usage_posts(like_count);

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
    CONSTRAINT fk_ideas_user
        FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS idea_attachments (
    attachment_id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    size INTEGER NOT NULL,
    content_type TEXT,
    created_at TEXT NOT NULL,
    CONSTRAINT fk_idea_attachments_idea
        FOREIGN KEY (idea_id) REFERENCES ideas(idea_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_ideas_user_created_at ON ideas(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_idea_attachments_idea_id ON idea_attachments(idea_id);

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
    CONSTRAINT fk_dx_discovery_sessions_user
        FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS dx_discovery_messages (
    message_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    seq INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    CONSTRAINT fk_dx_discovery_messages_session
        FOREIGN KEY (session_id) REFERENCES dx_discovery_sessions(session_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_dx_discovery_sessions_user_updated_at
    ON dx_discovery_sessions(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_dx_discovery_messages_session_seq
    ON dx_discovery_messages(session_id, seq);

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
    has_data INTEGER NOT NULL DEFAULT 1 CHECK (has_data IN (0, 1)),
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
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    submitted_at TEXT,
    reviewed_at TEXT,
    reviewed_by TEXT,
    review_comment TEXT,
    has_train_validation_split INTEGER NOT NULL DEFAULT 0
        CHECK (has_train_validation_split IN (0, 1)),
    view_count INTEGER NOT NULL DEFAULT 0,
    diffusion_attempt_count INTEGER NOT NULL DEFAULT 0,
    diffusion_completed_count INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    CONSTRAINT fk_ai_assets_created_by
        FOREIGN KEY (created_by) REFERENCES "user"(user_id) ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS ai_asset_slides (
    slide_id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    caption TEXT,
    description TEXT,
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    CONSTRAINT fk_ai_asset_slides_asset
        FOREIGN KEY (asset_id) REFERENCES ai_assets(asset_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS ai_asset_data_files (
    data_file_id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    data_role TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    content_type TEXT,
    created_at TEXT NOT NULL,
    CONSTRAINT fk_ai_asset_data_files_asset
        FOREIGN KEY (asset_id) REFERENCES ai_assets(asset_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS ai_asset_skill_files (
    skill_file_id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT fk_ai_asset_skill_files_asset
        FOREIGN KEY (asset_id) REFERENCES ai_assets(asset_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS ai_asset_bookmarks (
    user_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, asset_id),
    CONSTRAINT fk_ai_asset_bookmarks_user
        FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT fk_ai_asset_bookmarks_asset
        FOREIGN KEY (asset_id) REFERENCES ai_assets(asset_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS ai_asset_diffusion_attempts (
    asset_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    first_attempted_at TEXT NOT NULL,
    PRIMARY KEY (asset_id, user_id),
    CONSTRAINT fk_ai_asset_diffusion_attempts_asset
        FOREIGN KEY (asset_id) REFERENCES ai_assets(asset_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT fk_ai_asset_diffusion_attempts_user
        FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
);

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
    CONSTRAINT fk_ai_asset_diffusion_cases_asset
        FOREIGN KEY (asset_id) REFERENCES ai_assets(asset_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT fk_ai_asset_diffusion_cases_user
        FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED
);

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
    CONSTRAINT fk_ai_asset_qa_posts_asset
        FOREIGN KEY (asset_id) REFERENCES ai_assets(asset_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT fk_ai_asset_qa_posts_user
        FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT fk_ai_asset_qa_posts_parent
        FOREIGN KEY (parent_post_id) REFERENCES ai_asset_qa_posts(qa_post_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS ai_asset_qa_helpful (
    qa_post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (qa_post_id, user_id),
    CONSTRAINT fk_ai_asset_qa_helpful_post
        FOREIGN KEY (qa_post_id) REFERENCES ai_asset_qa_posts(qa_post_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT fk_ai_asset_qa_helpful_user
        FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_ai_assets_created_at ON ai_assets(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_assets_approval_status ON ai_assets(approval_status);
CREATE INDEX IF NOT EXISTS idx_ai_asset_slides_asset_order ON ai_asset_slides(asset_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_ai_asset_data_files_asset_role ON ai_asset_data_files(asset_id, data_role);
CREATE INDEX IF NOT EXISTS idx_ai_asset_skill_files_asset_path ON ai_asset_skill_files(asset_id, file_path);
CREATE INDEX IF NOT EXISTS idx_ai_asset_bookmarks_user_created ON ai_asset_bookmarks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_asset_diffusion_attempts_user
    ON ai_asset_diffusion_attempts(user_id, first_attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_asset_diffusion_cases_asset_created
    ON ai_asset_diffusion_cases(asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_asset_diffusion_cases_user_created
    ON ai_asset_diffusion_cases(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_asset_qa_posts_asset_created
    ON ai_asset_qa_posts(asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_asset_qa_posts_parent_created
    ON ai_asset_qa_posts(parent_post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_asset_qa_posts_user_created
    ON ai_asset_qa_posts(user_id, created_at DESC);

