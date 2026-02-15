CREATE TABLE IF NOT EXISTS maintenance_charges (
  id VARCHAR(36) PRIMARY KEY,
  unit_id VARCHAR(36) NOT NULL,
  period_month INT NOT NULL,
  period_year INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  due_date DATE,
  paid_date DATE,
  details JSON,
  FOREIGN KEY (unit_id) REFERENCES units(id)
);

CREATE TABLE IF NOT EXISTS assessments (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  total_amount DECIMAL(12,2),
  per_share_amount DECIMAL(10,4),
  effective_date DATE,
  details JSON
);

CREATE TABLE IF NOT EXISTS assessment_charges (
  id VARCHAR(36) PRIMARY KEY,
  assessment_id VARCHAR(36) NOT NULL,
  unit_id VARCHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  paid_date DATE,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id),
  FOREIGN KEY (unit_id) REFERENCES units(id)
);
