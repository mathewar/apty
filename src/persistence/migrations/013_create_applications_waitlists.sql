CREATE TABLE IF NOT EXISTS applications (
  id VARCHAR(36) PRIMARY KEY,
  unit_id VARCHAR(36) NOT NULL,
  type VARCHAR(20) NOT NULL,
  applicant_name VARCHAR(255),
  applicant_email VARCHAR(255),
  status VARCHAR(30) DEFAULT 'submitted',
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  board_decision VARCHAR(20),
  notes TEXT,
  details JSON,
  FOREIGN KEY (unit_id) REFERENCES units(id)
);

CREATE TABLE IF NOT EXISTS waitlists (
  id VARCHAR(36) PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  resident_id VARCHAR(36) NOT NULL,
  position INT,
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  fulfilled_at DATETIME,
  FOREIGN KEY (resident_id) REFERENCES residents(id)
);
