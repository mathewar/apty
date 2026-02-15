CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  file_path VARCHAR(500),
  uploaded_by VARCHAR(36),
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  details JSON,
  FOREIGN KEY (uploaded_by) REFERENCES residents(id)
);
