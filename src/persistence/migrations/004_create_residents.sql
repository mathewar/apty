CREATE TABLE IF NOT EXISTS residents (
  id VARCHAR(36) PRIMARY KEY,
  unit_id VARCHAR(36) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(20) DEFAULT 'shareholder',
  is_primary BOOLEAN DEFAULT FALSE,
  move_in_date DATE,
  move_out_date DATE,
  shares_held INT,
  details JSON,
  FOREIGN KEY (unit_id) REFERENCES units(id)
);
