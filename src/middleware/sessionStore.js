const session = require('express-session');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const Store = session.Store;

class SqliteStore extends Store {
    constructor(options = {}) {
        super(options);
        const dbPath = options.dbPath ||
            process.env.SQLITE_DB ||
            path.join(__dirname, '..', '..', 'data', 'apty.db');
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.exec(`CREATE TABLE IF NOT EXISTS sessions (
            session_id VARCHAR(128) PRIMARY KEY,
            expires INTEGER NOT NULL,
            data TEXT
        )`);

        // Clean expired sessions every 15 minutes
        this._cleanInterval = setInterval(() => this._cleanup(), 15 * 60 * 1000);
    }

    get(sid, callback) {
        try {
            const row = this.db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sid);
            if (!row) return callback(null, null);
            if (row.expires && row.expires < Date.now()) {
                this.destroy(sid, () => {});
                return callback(null, null);
            }
            callback(null, JSON.parse(row.data));
        } catch (err) {
            callback(err);
        }
    }

    set(sid, sessionData, callback) {
        try {
            const expires = sessionData.cookie && sessionData.cookie.expires
                ? new Date(sessionData.cookie.expires).getTime()
                : Date.now() + 86400000;
            this.db.prepare(
                'INSERT OR REPLACE INTO sessions (session_id, expires, data) VALUES (?, ?, ?)',
            ).run(sid, expires, JSON.stringify(sessionData));
            callback(null);
        } catch (err) {
            callback(err);
        }
    }

    destroy(sid, callback) {
        try {
            this.db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sid);
            callback(null);
        } catch (err) {
            callback(err);
        }
    }

    _cleanup() {
        try {
            this.db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
        } catch (_) {}
    }

    close() {
        clearInterval(this._cleanInterval);
        if (this.db) this.db.close();
    }
}

module.exports = SqliteStore;
