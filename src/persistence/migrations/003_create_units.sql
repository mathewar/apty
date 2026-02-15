CREATE TABLE IF NOT EXISTS units (
  id VARCHAR(36) PRIMARY KEY,
  building_id VARCHAR(36) NOT NULL,
  unit_number VARCHAR(20) NOT NULL,
  floor INT,
  rooms DECIMAL(3,1),
  square_feet INT,
  shares INT,
  monthly_maintenance DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'occupied',
  details JSON,
  FOREIGN KEY (building_id) REFERENCES building(id)
);
