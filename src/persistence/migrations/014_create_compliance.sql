CREATE TABLE IF NOT EXISTS compliance_items (
  id VARCHAR(36) PRIMARY KEY,
  law_name VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE,
  status VARCHAR(30) DEFAULT 'upcoming',
  vendor_id VARCHAR(36),
  cost DECIMAL(12,2),
  notes TEXT,
  details JSON,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

CREATE TABLE IF NOT EXISTS violations (
  id VARCHAR(36) PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  violation_number VARCHAR(100),
  description TEXT,
  issued_date DATE,
  status VARCHAR(30) DEFAULT 'open',
  penalty DECIMAL(10,2),
  details JSON
);
