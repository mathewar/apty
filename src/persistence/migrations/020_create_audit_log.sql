CREATE TABLE IF NOT EXISTS audit_log (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    user_email VARCHAR(200),
    user_role VARCHAR(50),
    action VARCHAR(20) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(36),
    summary TEXT,
    created_at DATETIME DEFAULT NOW()
);
