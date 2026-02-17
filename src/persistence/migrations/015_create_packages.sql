CREATE TABLE IF NOT EXISTS packages (
    id VARCHAR(36) PRIMARY KEY,
    unit_id VARCHAR(36) REFERENCES units(id),
    resident_id VARCHAR(36) REFERENCES residents(id),
    carrier VARCHAR(100),
    tracking_number VARCHAR(200),
    description TEXT,
    status VARCHAR(50) DEFAULT 'arrived',
    received_at DATETIME DEFAULT NOW(),
    picked_up_at DATETIME,
    received_by VARCHAR(36),
    source VARCHAR(100) DEFAULT 'manual',
    provider_event_id VARCHAR(200),
    details TEXT
);
