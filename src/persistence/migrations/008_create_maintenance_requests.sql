CREATE TABLE IF NOT EXISTS maintenance_requests (
  id VARCHAR(36) PRIMARY KEY,
  unit_id VARCHAR(36),
  submitted_by VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(100),
  priority VARCHAR(20) DEFAULT 'normal',
  status VARCHAR(20) DEFAULT 'open',
  assigned_to VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  details JSON,
  FOREIGN KEY (unit_id) REFERENCES units(id),
  FOREIGN KEY (submitted_by) REFERENCES residents(id)
);
