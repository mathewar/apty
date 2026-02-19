const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.SQLITE_DB || path.join(__dirname, '..', '..', 'data', 'apty.db');

let db;

function query(sql, params = []) {
    // Rewrite MySQL-isms for SQLite
    sql = sql.replace(/NOW\(\)/g, "datetime('now')");
    sql = sql.replace(/MEDIUMTEXT/gi, 'TEXT');
    sql = sql.replace(/INT UNSIGNED/gi, 'INTEGER');
    sql = sql.replace(/JSON/gi, 'TEXT');

    const trimmed = sql.trim().toUpperCase();
    if (
        trimmed.startsWith('SELECT') ||
        trimmed.startsWith('PRAGMA') ||
        trimmed.startsWith('WITH')
    ) {
        return db.prepare(sql).all(...params);
    }
    const result = db.prepare(sql).run(...params);
    return result;
}

function runMigrations() {
    db.exec(`CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT DEFAULT (datetime('now'))
    )`);

    const applied = db.prepare('SELECT name FROM migrations').all();
    const appliedSet = new Set(applied.map(r => r.name));

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs
        .readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    for (const file of files) {
        if (appliedSet.has(file)) continue;
        let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        // Adapt MySQL DDL for SQLite
        sql = sql.replace(/MEDIUMTEXT/gi, 'TEXT');
        sql = sql.replace(/INT UNSIGNED/gi, 'INTEGER');
        sql = sql.replace(/JSON/gi, 'TEXT');
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        for (const statement of statements) {
            db.exec(statement);
        }
        db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
        console.log(`Migration applied: ${file}`);
    }
}

async function init() {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations();
    console.log(`Connected to SQLite db at ${DB_PATH}`);
}

async function teardown() {
    if (db) db.close();
}

// ── Legacy homes CRUD ──
async function getHomes() {
    return query('SELECT * FROM homes');
}
async function getHome(id) {
    return query('SELECT * FROM homes WHERE id=?', [id])[0];
}
async function storeHome(item) {
    query('INSERT INTO homes (id, name) VALUES (?, ?)', [item.id, item.name]);
}
async function updateHome(id, item) {
    query('UPDATE homes SET name=? WHERE id=?', [item.name, id]);
}
async function removeHome(id) {
    query('DELETE FROM homes WHERE id = ?', [id]);
}

// ── Building ──
async function getBuilding() {
    return query('SELECT * FROM building LIMIT 1')[0] || null;
}
async function upsertBuilding(b) {
    const existing = await getBuilding();
    if (existing) {
        query(
            `UPDATE building SET name=?, address=?, city=?, state=?, zip=?,
             year_built=?, total_floors=?, total_units=?, building_type=?, details=?
             WHERE id=?`,
            [b.name, b.address, b.city, b.state, b.zip,
             b.year_built, b.total_floors, b.total_units, b.building_type,
             JSON.stringify(b.details || null), existing.id],
        );
        return Object.assign({}, existing, b);
    }
    query(
        `INSERT INTO building (id, name, address, city, state, zip, year_built,
         total_floors, total_units, building_type, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [b.id, b.name, b.address, b.city, b.state, b.zip,
         b.year_built, b.total_floors, b.total_units, b.building_type,
         JSON.stringify(b.details || null)],
    );
    return b;
}

// ── Units ──
async function getUnits(buildingId) {
    return buildingId
        ? query('SELECT * FROM units WHERE building_id=? ORDER BY floor, unit_number', [buildingId])
        : query('SELECT * FROM units ORDER BY floor, unit_number');
}
async function getUnit(id) {
    return query('SELECT * FROM units WHERE id=?', [id])[0] || null;
}
async function storeUnit(u) {
    query(
        `INSERT INTO units (id, building_id, unit_number, floor, rooms,
         square_feet, shares, monthly_maintenance, status, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [u.id, u.building_id, u.unit_number, u.floor, u.rooms,
         u.square_feet, u.shares, u.monthly_maintenance,
         u.status || 'occupied', JSON.stringify(u.details || null)],
    );
}
async function updateUnit(id, u) {
    query(
        `UPDATE units SET unit_number=?, floor=?, rooms=?, square_feet=?,
         shares=?, monthly_maintenance=?, status=?, details=? WHERE id=?`,
        [u.unit_number, u.floor, u.rooms, u.square_feet, u.shares,
         u.monthly_maintenance, u.status, JSON.stringify(u.details || null), id],
    );
}
async function removeUnit(id) {
    query('DELETE FROM units WHERE id=?', [id]);
}

// ── Residents ──
async function getResidents(filters) {
    let sql = 'SELECT * FROM residents WHERE 1=1';
    const params = [];
    if (filters && filters.unit_id) { sql += ' AND unit_id=?'; params.push(filters.unit_id); }
    if (filters && filters.role) { sql += ' AND role=?'; params.push(filters.role); }
    sql += ' ORDER BY last_name, first_name';
    return query(sql, params);
}
async function getResident(id) {
    return query('SELECT * FROM residents WHERE id=?', [id])[0] || null;
}
async function storeResident(r) {
    query(
        `INSERT INTO residents (id, unit_id, first_name, last_name, email,
         phone, role, is_primary, move_in_date, shares_held, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.unit_id, r.first_name, r.last_name, r.email, r.phone,
         r.role || 'shareholder', r.is_primary ? 1 : 0, r.move_in_date,
         r.shares_held, JSON.stringify(r.details || null)],
    );
}
async function updateResident(id, r) {
    query(
        `UPDATE residents SET unit_id=?, first_name=?, last_name=?, email=?,
         phone=?, role=?, is_primary=?, move_in_date=?, move_out_date=?,
         shares_held=?, details=? WHERE id=?`,
        [r.unit_id, r.first_name, r.last_name, r.email, r.phone,
         r.role, r.is_primary ? 1 : 0, r.move_in_date, r.move_out_date || null,
         r.shares_held, JSON.stringify(r.details || null), id],
    );
}
async function removeResident(id) {
    query('DELETE FROM residents WHERE id=?', [id]);
}

// ── Board Members ──
async function getBoardMembers(activeOnly) {
    const sql = activeOnly
        ? `SELECT bm.*, r.first_name, r.last_name, r.email
           FROM board_members bm JOIN residents r ON bm.resident_id=r.id
           WHERE bm.is_active=1
           ORDER BY CASE bm.role
             WHEN 'president' THEN 1 WHEN 'vice_president' THEN 2
             WHEN 'treasurer' THEN 3 WHEN 'secretary' THEN 4 ELSE 5 END`
        : `SELECT bm.*, r.first_name, r.last_name, r.email
           FROM board_members bm JOIN residents r ON bm.resident_id=r.id
           ORDER BY bm.is_active DESC, bm.term_start DESC`;
    return query(sql);
}
async function storeBoardMember(bm) {
    query(
        `INSERT INTO board_members (id, resident_id, role, term_start, term_end, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [bm.id, bm.resident_id, bm.role, bm.term_start, bm.term_end, bm.is_active !== false ? 1 : 0],
    );
}
async function updateBoardMember(id, bm) {
    query(
        'UPDATE board_members SET role=?, term_start=?, term_end=?, is_active=? WHERE id=?',
        [bm.role, bm.term_start, bm.term_end, bm.is_active ? 1 : 0, id],
    );
}
async function removeBoardMember(id) {
    query('DELETE FROM board_members WHERE id=?', [id]);
}

// ── Announcements ──
async function getAnnouncements() {
    return query(
        `SELECT a.*, r.first_name, r.last_name FROM announcements a
         LEFT JOIN residents r ON a.posted_by=r.id
         ORDER BY a.posted_at DESC`,
    );
}
async function getAnnouncement(id) {
    return query('SELECT * FROM announcements WHERE id=?', [id])[0] || null;
}
async function storeAnnouncement(a) {
    query(
        `INSERT INTO announcements (id, title, body, category, posted_by, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [a.id, a.title, a.body, a.category, a.posted_by, a.expires_at],
    );
}
async function updateAnnouncement(id, a) {
    query(
        'UPDATE announcements SET title=?, body=?, category=?, expires_at=? WHERE id=?',
        [a.title, a.body, a.category, a.expires_at, id],
    );
}
async function removeAnnouncement(id) {
    query('DELETE FROM announcements WHERE id=?', [id]);
}

// ── Documents ──
async function getDocuments(category) {
    let sql = 'SELECT d.*, r.first_name, r.last_name FROM documents d LEFT JOIN residents r ON d.uploaded_by=r.id';
    const params = [];
    if (category) { sql += ' WHERE d.category=?'; params.push(category); }
    sql += ' ORDER BY d.uploaded_at DESC';
    return query(sql, params);
}
async function storeDocument(d) {
    query(
        `INSERT INTO documents (id, title, category, file_path, uploaded_by, details)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [d.id, d.title, d.category, d.file_path, d.uploaded_by, JSON.stringify(d.details || null)],
    );
}
async function removeDocument(id) {
    const rows = query('SELECT * FROM documents WHERE id=?', [id]);
    query('DELETE FROM documents WHERE id=?', [id]);
    return rows[0] || null;
}

// ── Maintenance Requests ──
async function getMaintenanceRequests(filters) {
    let sql = `SELECT mr.*, r.first_name, r.last_name, u.unit_number
               FROM maintenance_requests mr
               LEFT JOIN residents r ON mr.submitted_by=r.id
               LEFT JOIN units u ON mr.unit_id=u.id WHERE 1=1`;
    const params = [];
    if (filters && filters.status) { sql += ' AND mr.status=?'; params.push(filters.status); }
    if (filters && filters.unit_id) { sql += ' AND mr.unit_id=?'; params.push(filters.unit_id); }
    if (filters && filters.submitted_by) { sql += ' AND mr.submitted_by=?'; params.push(filters.submitted_by); }
    if (filters && filters.priority) { sql += ' AND mr.priority=?'; params.push(filters.priority); }
    sql += ' ORDER BY mr.created_at DESC';
    return query(sql, params);
}
async function getMaintenanceRequest(id) {
    return query(
        `SELECT mr.*, r.first_name, r.last_name, u.unit_number
         FROM maintenance_requests mr
         LEFT JOIN residents r ON mr.submitted_by=r.id
         LEFT JOIN units u ON mr.unit_id=u.id
         WHERE mr.id=?`, [id],
    )[0] || null;
}
async function storeMaintenanceRequest(mr) {
    query(
        `INSERT INTO maintenance_requests
         (id, unit_id, submitted_by, title, description, location, priority, status, assigned_to)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [mr.id, mr.unit_id, mr.submitted_by, mr.title, mr.description,
         mr.location, mr.priority || 'normal', mr.status || 'open', mr.assigned_to],
    );
}
async function updateMaintenanceRequest(id, mr) {
    const sets = [];
    const params = [];
    if (mr.title !== undefined) { sets.push('title=?'); params.push(mr.title); }
    if (mr.description !== undefined) { sets.push('description=?'); params.push(mr.description); }
    if (mr.location !== undefined) { sets.push('location=?'); params.push(mr.location); }
    if (mr.priority !== undefined) { sets.push('priority=?'); params.push(mr.priority); }
    if (mr.status !== undefined) { sets.push('status=?'); params.push(mr.status); }
    if (mr.assigned_to !== undefined) { sets.push('assigned_to=?'); params.push(mr.assigned_to); }
    if (mr.resolved_at !== undefined) { sets.push('resolved_at=?'); params.push(mr.resolved_at); }
    sets.push("updated_at=datetime('now')");
    params.push(id);
    query(`UPDATE maintenance_requests SET ${sets.join(', ')} WHERE id=?`, params);
}
async function removeMaintenanceRequest(id) {
    query('DELETE FROM request_comments WHERE request_id=?', [id]);
    query('DELETE FROM maintenance_requests WHERE id=?', [id]);
}

// ── Request Comments ──
async function getRequestComments(requestId) {
    return query(
        `SELECT rc.*, r.first_name, r.last_name FROM request_comments rc
         LEFT JOIN residents r ON rc.author_id=r.id
         WHERE rc.request_id=? ORDER BY rc.created_at ASC`, [requestId],
    );
}
async function storeRequestComment(c) {
    query(
        'INSERT INTO request_comments (id, request_id, author_id, body) VALUES (?, ?, ?, ?)',
        [c.id, c.request_id, c.author_id, c.body],
    );
}

// ── Maintenance Charges ──
async function getMaintenanceCharges(filters) {
    let sql = `SELECT mc.*, u.unit_number FROM maintenance_charges mc
               JOIN units u ON mc.unit_id=u.id WHERE 1=1`;
    const params = [];
    if (filters && filters.unit_id) { sql += ' AND mc.unit_id=?'; params.push(filters.unit_id); }
    if (filters && filters.period_year) { sql += ' AND mc.period_year=?'; params.push(filters.period_year); }
    if (filters && filters.period_month) { sql += ' AND mc.period_month=?'; params.push(filters.period_month); }
    if (filters && filters.status) { sql += ' AND mc.status=?'; params.push(filters.status); }
    sql += ' ORDER BY mc.period_year DESC, mc.period_month DESC, u.unit_number';
    return query(sql, params);
}
async function storeMaintenanceCharge(mc) {
    query(
        `INSERT INTO maintenance_charges (id, unit_id, period_month, period_year, amount, status, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [mc.id, mc.unit_id, mc.period_month, mc.period_year, mc.amount, mc.status || 'pending', mc.due_date],
    );
}
async function updateMaintenanceCharge(id, mc) {
    query('UPDATE maintenance_charges SET status=?, paid_date=? WHERE id=?', [mc.status, mc.paid_date, id]);
}

// ── Assessments ──
async function getAssessments() {
    return query('SELECT * FROM assessments ORDER BY effective_date DESC');
}
async function storeAssessment(a) {
    query(
        `INSERT INTO assessments (id, title, description, total_amount, per_share_amount, effective_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [a.id, a.title, a.description, a.total_amount, a.per_share_amount, a.effective_date],
    );
}
async function getAssessmentCharges(assessmentId) {
    return query(
        `SELECT ac.*, u.unit_number, u.shares FROM assessment_charges ac
         JOIN units u ON ac.unit_id=u.id WHERE ac.assessment_id=?
         ORDER BY u.unit_number`, [assessmentId],
    );
}
async function storeAssessmentCharge(ac) {
    query(
        'INSERT INTO assessment_charges (id, assessment_id, unit_id, amount, status) VALUES (?, ?, ?, ?, ?)',
        [ac.id, ac.assessment_id, ac.unit_id, ac.amount, ac.status || 'pending'],
    );
}
async function updateAssessmentCharge(id, ac) {
    query('UPDATE assessment_charges SET status=?, paid_date=? WHERE id=?', [ac.status, ac.paid_date, id]);
}

// ── Users / Auth ──
async function getUserByEmail(email) {
    return query('SELECT * FROM users WHERE email=?', [email])[0] || null;
}
async function getUserById(id) {
    return query('SELECT * FROM users WHERE id=?', [id])[0] || null;
}
async function storeUser(u) {
    query(
        'INSERT INTO users (id, email, password_hash, resident_id, role) VALUES (?, ?, ?, ?, ?)',
        [u.id, u.email, u.password_hash, u.resident_id, u.role || 'resident'],
    );
}
async function getUsers() {
    return query(
        `SELECT u.id, u.email, u.role, u.resident_id, u.created_at,
                r.first_name, r.last_name
         FROM users u LEFT JOIN residents r ON u.resident_id=r.id ORDER BY u.email`,
    );
}
async function updateUser(id, u) {
    const sets = [];
    const params = [];
    if (u.email !== undefined) { sets.push('email=?'); params.push(u.email); }
    if (u.password_hash !== undefined) { sets.push('password_hash=?'); params.push(u.password_hash); }
    if (u.role !== undefined) { sets.push('role=?'); params.push(u.role); }
    if (u.resident_id !== undefined) { sets.push('resident_id=?'); params.push(u.resident_id); }
    if (sets.length === 0) return;
    params.push(id);
    query(`UPDATE users SET ${sets.join(', ')} WHERE id=?`, params);
}
async function removeUser(id) {
    query('DELETE FROM users WHERE id=?', [id]);
}

// ── Staff ──
async function getStaff() {
    return query('SELECT * FROM staff WHERE is_active=1 ORDER BY name');
}
async function storeStaffMember(s) {
    query(
        `INSERT INTO staff (id, name, role, phone, email, schedule, is_active, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.id, s.name, s.role, s.phone, s.email, s.schedule, s.is_active !== false ? 1 : 0, JSON.stringify(s.details || null)],
    );
}
async function updateStaffMember(id, s) {
    query(
        'UPDATE staff SET name=?, role=?, phone=?, email=?, schedule=?, is_active=?, details=? WHERE id=?',
        [s.name, s.role, s.phone, s.email, s.schedule, s.is_active ? 1 : 0, JSON.stringify(s.details || null), id],
    );
}
async function removeStaffMember(id) {
    query('DELETE FROM staff WHERE id=?', [id]);
}

// ── Vendors ──
async function getVendors() {
    return query('SELECT * FROM vendors ORDER BY trade, company_name');
}
async function storeVendor(v) {
    query(
        `INSERT INTO vendors (id, company_name, contact_name, trade, phone, email, contract_expires, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [v.id, v.company_name, v.contact_name, v.trade, v.phone, v.email, v.contract_expires, JSON.stringify(v.details || null)],
    );
}
async function updateVendor(id, v) {
    query(
        `UPDATE vendors SET company_name=?, contact_name=?, trade=?, phone=?, email=?,
         contract_expires=?, details=? WHERE id=?`,
        [v.company_name, v.contact_name, v.trade, v.phone, v.email, v.contract_expires, JSON.stringify(v.details || null), id],
    );
}
async function removeVendor(id) {
    query('DELETE FROM vendors WHERE id=?', [id]);
}

// ── Applications ──
async function getApplications(filters) {
    let sql = `SELECT a.*, u.unit_number FROM applications a
               JOIN units u ON a.unit_id=u.id WHERE 1=1`;
    const params = [];
    if (filters && filters.status) { sql += ' AND a.status=?'; params.push(filters.status); }
    if (filters && filters.type) { sql += ' AND a.type=?'; params.push(filters.type); }
    if (filters && filters.unit_id) { sql += ' AND a.unit_id=?'; params.push(filters.unit_id); }
    sql += ' ORDER BY a.submitted_at DESC';
    return query(sql, params);
}
async function getApplication(id) {
    return query(
        'SELECT a.*, u.unit_number FROM applications a JOIN units u ON a.unit_id=u.id WHERE a.id=?', [id],
    )[0] || null;
}
async function storeApplication(a) {
    query(
        `INSERT INTO applications (id, unit_id, type, applicant_name, applicant_email, status, notes, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [a.id, a.unit_id, a.type, a.applicant_name, a.applicant_email, a.status || 'submitted', a.notes, JSON.stringify(a.details || null)],
    );
}
async function updateApplication(id, a) {
    const sets = [];
    const params = [];
    if (a.status !== undefined) { sets.push('status=?'); params.push(a.status); }
    if (a.board_decision !== undefined) { sets.push('board_decision=?'); params.push(a.board_decision); }
    if (a.notes !== undefined) { sets.push('notes=?'); params.push(a.notes); }
    if (a.reviewed_at !== undefined) { sets.push('reviewed_at=?'); params.push(a.reviewed_at); }
    if (sets.length === 0) return;
    params.push(id);
    query(`UPDATE applications SET ${sets.join(', ')} WHERE id=?`, params);
}

// ── Waitlists ──
async function getWaitlist(type) {
    let sql = `SELECT w.*, r.first_name, r.last_name, u.unit_number
               FROM waitlists w
               JOIN residents r ON w.resident_id=r.id
               JOIN units u ON r.unit_id=u.id WHERE 1=1`;
    const params = [];
    if (type) { sql += ' AND w.type=?'; params.push(type); }
    sql += ' ORDER BY w.type, w.position';
    return query(sql, params);
}
async function storeWaitlistEntry(w) {
    if (!w.position) {
        const rows = query('SELECT MAX(position) as maxPos FROM waitlists WHERE type=?', [w.type]);
        w.position = (rows[0].maxPos || 0) + 1;
    }
    query(
        'INSERT INTO waitlists (id, type, resident_id, position) VALUES (?, ?, ?, ?)',
        [w.id, w.type, w.resident_id, w.position],
    );
}
async function updateWaitlistEntry(id, w) {
    query('UPDATE waitlists SET position=?, fulfilled_at=? WHERE id=?', [w.position, w.fulfilled_at, id]);
}
async function removeWaitlistEntry(id) {
    query('DELETE FROM waitlists WHERE id=?', [id]);
}

// ── Compliance ──
async function getComplianceItems() {
    return query(
        `SELECT ci.*, v.company_name as vendor_name FROM compliance_items ci
         LEFT JOIN vendors v ON ci.vendor_id=v.id ORDER BY ci.due_date`,
    );
}
async function storeComplianceItem(ci) {
    query(
        `INSERT INTO compliance_items (id, law_name, description, due_date, status, vendor_id, cost, notes, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ci.id, ci.law_name, ci.description, ci.due_date, ci.status || 'upcoming', ci.vendor_id, ci.cost, ci.notes, JSON.stringify(ci.details || null)],
    );
}
async function updateComplianceItem(id, ci) {
    const sets = [];
    const params = [];
    if (ci.law_name !== undefined) { sets.push('law_name=?'); params.push(ci.law_name); }
    if (ci.description !== undefined) { sets.push('description=?'); params.push(ci.description); }
    if (ci.due_date !== undefined) { sets.push('due_date=?'); params.push(ci.due_date); }
    if (ci.status !== undefined) { sets.push('status=?'); params.push(ci.status); }
    if (ci.vendor_id !== undefined) { sets.push('vendor_id=?'); params.push(ci.vendor_id); }
    if (ci.cost !== undefined) { sets.push('cost=?'); params.push(ci.cost); }
    if (ci.notes !== undefined) { sets.push('notes=?'); params.push(ci.notes); }
    if (sets.length === 0) return;
    params.push(id);
    query(`UPDATE compliance_items SET ${sets.join(', ')} WHERE id=?`, params);
}
async function removeComplianceItem(id) {
    query('DELETE FROM compliance_items WHERE id=?', [id]);
}

// ── Violations ──
async function getViolations() {
    return query('SELECT * FROM violations ORDER BY issued_date DESC');
}
async function storeViolation(v) {
    query(
        `INSERT INTO violations (id, source, violation_number, description, issued_date, status, penalty, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [v.id, v.source, v.violation_number, v.description, v.issued_date, v.status || 'open', v.penalty, JSON.stringify(v.details || null)],
    );
}
async function updateViolation(id, v) {
    const sets = [];
    const params = [];
    if (v.status !== undefined) { sets.push('status=?'); params.push(v.status); }
    if (v.description !== undefined) { sets.push('description=?'); params.push(v.description); }
    if (v.penalty !== undefined) { sets.push('penalty=?'); params.push(v.penalty); }
    if (sets.length === 0) return;
    params.push(id);
    query(`UPDATE violations SET ${sets.join(', ')} WHERE id=?`, params);
}
async function removeViolation(id) {
    query('DELETE FROM violations WHERE id=?', [id]);
}

module.exports = {
    init, teardown,
    getHomes, getHome, storeHome, updateHome, removeHome,
    getBuilding, upsertBuilding,
    getUnits, getUnit, storeUnit, updateUnit, removeUnit,
    getResidents, getResident, storeResident, updateResident, removeResident,
    getBoardMembers, storeBoardMember, updateBoardMember, removeBoardMember,
    getAnnouncements, getAnnouncement, storeAnnouncement, updateAnnouncement, removeAnnouncement,
    getDocuments, storeDocument, removeDocument,
    getMaintenanceRequests, getMaintenanceRequest, storeMaintenanceRequest,
    updateMaintenanceRequest, removeMaintenanceRequest,
    getRequestComments, storeRequestComment,
    getMaintenanceCharges, storeMaintenanceCharge, updateMaintenanceCharge,
    getAssessments, storeAssessment, getAssessmentCharges, storeAssessmentCharge, updateAssessmentCharge,
    getUserByEmail, getUserById, storeUser, getUsers, updateUser, removeUser,
    getStaff, storeStaffMember, updateStaffMember, removeStaffMember,
    getVendors, storeVendor, updateVendor, removeVendor,
    getApplications, getApplication, storeApplication, updateApplication,
    getWaitlist, storeWaitlistEntry, updateWaitlistEntry, removeWaitlistEntry,
    getComplianceItems, storeComplianceItem, updateComplianceItem, removeComplianceItem,
    getViolations, storeViolation, updateViolation, removeViolation,
};
