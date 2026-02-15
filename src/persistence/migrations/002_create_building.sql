CREATE TABLE IF NOT EXISTS building (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(255),
  city VARCHAR(100) DEFAULT 'New York',
  state VARCHAR(2) DEFAULT 'NY',
  zip VARCHAR(10),
  year_built INT,
  total_floors INT,
  total_units INT,
  building_type VARCHAR(20) DEFAULT 'coop',
  details JSON
);
