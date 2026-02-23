CREATE TABLE IF NOT EXISTS feedback (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    user_email VARCHAR(200),
    user_role VARCHAR(50),
    page VARCHAR(100),
    url TEXT,
    feedback_text TEXT NOT NULL,
    screenshot_data TEXT,
    user_agent TEXT,
    viewport TEXT,
    created_at DATETIME DEFAULT NOW()
);
