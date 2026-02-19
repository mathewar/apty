ALTER TABLE documents ADD COLUMN analysis_json TEXT;
ALTER TABLE documents ADD COLUMN file_size INTEGER;
ALTER TABLE documents ADD COLUMN mime_type VARCHAR(100);
