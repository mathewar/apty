UPDATE users SET role = 'admin' WHERE role IN ('staff');
UPDATE users SET role = 'resident' WHERE role NOT IN ('admin', 'resident');
