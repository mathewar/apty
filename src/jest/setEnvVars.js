// Use SQLite for tests (no MYSQL_HOST means SQLite is selected)
delete process.env.MYSQL_HOST;
delete process.env.MYSQL_USER;
delete process.env.MYSQL_PASSWORD;
delete process.env.MYSQL_DB;
process.env.NODE_ENV = 'test';
