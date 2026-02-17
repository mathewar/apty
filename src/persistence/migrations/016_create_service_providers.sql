CREATE TABLE IF NOT EXISTS service_providers (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    provider_type VARCHAR(100),
    api_key_hash VARCHAR(200),
    is_active BOOLEAN DEFAULT 1,
    config TEXT,
    created_at DATETIME DEFAULT NOW()
);
