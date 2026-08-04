CREATE TABLE IF NOT EXISTS user (
    user_id TEXT PRIMARY KEY,
    login_id TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    org_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    displayed_name TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_login_id ON user(login_id);

CREATE TABLE IF NOT EXISTS user_sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS news (
    news_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    writer TEXT NOT NULL,
    cover_image TEXT,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (writer) REFERENCES user(user_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_news_created_at ON news(created_at);

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
);

CREATE TABLE IF NOT EXISTS ai_usage_post_likes (
    usage_post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (usage_post_id, user_id),
    FOREIGN KEY (usage_post_id) REFERENCES ai_usage_posts(usage_post_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
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
    FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS idea_attachments (
    attachment_id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    size INTEGER NOT NULL,
    content_type TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (idea_id) REFERENCES ideas(idea_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ideas_user_created_at ON ideas(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_idea_attachments_idea_id ON idea_attachments(idea_id);

