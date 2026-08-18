-- Migration 0002: Research Persistence (Threads & Messages)
-- Non-destructive creation of persistent research threads and message tables

CREATE TABLE IF NOT EXISTS research_threads (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    market_context TEXT DEFAULT 'CN',
    active_symbol TEXT,
    model TEXT,
    message_count INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_message_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_research_threads_user_active ON research_threads(user_id, deleted_at, last_message_at);
CREATE INDEX IF NOT EXISTS idx_research_threads_user_pinned ON research_threads(user_id, pinned);

CREATE TABLE IF NOT EXISTS research_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    client_message_id TEXT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL,
    provider TEXT,
    model TEXT,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER,
    error_code TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    FOREIGN KEY (thread_id) REFERENCES research_threads(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(thread_id, client_message_id)
);

CREATE INDEX IF NOT EXISTS idx_research_messages_thread_created ON research_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_research_messages_user_thread ON research_messages(user_id, thread_id);
