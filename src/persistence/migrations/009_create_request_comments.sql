CREATE TABLE IF NOT EXISTS request_comments (
  id VARCHAR(36) PRIMARY KEY,
  request_id VARCHAR(36) NOT NULL,
  author_id VARCHAR(36),
  body TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES maintenance_requests(id),
  FOREIGN KEY (author_id) REFERENCES residents(id)
);
