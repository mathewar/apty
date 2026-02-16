CREATE TABLE IF NOT EXISTS staff (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  schedule VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  details JSON
);

CREATE TABLE IF NOT EXISTS vendors (
  id VARCHAR(36) PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  trade VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  contract_expires DATE,
  details JSON
);
