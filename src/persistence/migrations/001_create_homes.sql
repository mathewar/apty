CREATE TABLE IF NOT EXISTS homes (
  id VARCHAR(36),
  parent_id VARCHAR(36),
  name VARCHAR(255),
  details JSON
);
