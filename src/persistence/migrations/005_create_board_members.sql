CREATE TABLE IF NOT EXISTS board_members (
  id VARCHAR(36) PRIMARY KEY,
  resident_id VARCHAR(36) NOT NULL,
  role VARCHAR(50) NOT NULL,
  term_start DATE,
  term_end DATE,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (resident_id) REFERENCES residents(id)
);
