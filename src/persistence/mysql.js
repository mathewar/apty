const waitPort = require('wait-port');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql');

const {
    MYSQL_HOST: HOST,
    MYSQL_HOST_FILE: HOST_FILE,
    MYSQL_USER: USER,
    MYSQL_USER_FILE: USER_FILE,
    MYSQL_PASSWORD: PASSWORD,
    MYSQL_PASSWORD_FILE: PASSWORD_FILE,
    MYSQL_DB: DB,
    MYSQL_DB_FILE: DB_FILE,
} = process.env;

let pool;

function query(sql, params) {
    return new Promise((resolve, reject) => {
        pool.query(sql, params, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
}

async function runMigrations() {
    await query(
        `CREATE TABLE IF NOT EXISTS migrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
    );

    const applied = await query('SELECT name FROM migrations');
    const appliedSet = new Set(applied.map(r => r.name));

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs
        .readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    for (const file of files) {
        if (appliedSet.has(file)) continue;
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        for (const statement of statements) {
            await query(statement);
        }
        await query('INSERT INTO migrations (name) VALUES (?)', [file]);
        console.log(`Migration applied: ${file}`);
    }
}

async function init() {
    const host = HOST_FILE
        ? fs.readFileSync(HOST_FILE, 'utf8').trim()
        : HOST;
    const user = USER_FILE
        ? fs.readFileSync(USER_FILE, 'utf8').trim()
        : USER;
    const password = PASSWORD_FILE
        ? fs.readFileSync(PASSWORD_FILE, 'utf8').trim()
        : PASSWORD;
    const database = DB_FILE
        ? fs.readFileSync(DB_FILE, 'utf8').trim()
        : DB;

    await waitPort({ host, port: 3306 });

    pool = mysql.createPool({
        connectionLimit: 5,
        host,
        user,
        password,
        database,
    });

    await runMigrations();
    console.log(`Connected to mysql db at host ${host}`);
}

async function teardown() {
    return new Promise((resolve, reject) => {
        pool.end(err => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// ── Building ──

async function getBuilding() {
    const rows = await query('SELECT * FROM building LIMIT 1');
    return rows[0] ? Object.assign({}, rows[0]) : null;
}

async function upsertBuilding(b) {
    const existing = await getBuilding();
    if (existing) {
        await query(
            `UPDATE building SET name=?, address=?, city=?, state=?, zip=?,
             year_built=?, total_floors=?, total_units=?, building_type=?, details=?
             WHERE id=?`,
            [
                b.name, b.address, b.city, b.state, b.zip,
                b.year_built, b.total_floors, b.total_units, b.building_type,
                JSON.stringify(b.details || null), existing.id,
            ],
        );
        return Object.assign({}, existing, b);
    }
    await query(
        `INSERT INTO building (id, name, address, city, state, zip, year_built,
         total_floors, total_units, building_type, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            b.id, b.name, b.address, b.city, b.state, b.zip,
            b.year_built, b.total_floors, b.total_units, b.building_type,
            JSON.stringify(b.details || null),
        ],
    );
    return b;
}

// ── Units ──

async function getUnits(buildingId) {
    const rows = buildingId
        ? await query(
              'SELECT * FROM units WHERE building_id=? ORDER BY floor, unit_number',
              [buildingId],
          )
        : await query('SELECT * FROM units ORDER BY floor, unit_number');
    return rows.map(r => Object.assign({}, r));
}

async function getUnit(id) {
    const rows = await query('SELECT * FROM units WHERE id=?', [id]);
    return rows[0] ? Object.assign({}, rows[0]) : null;
}

async function storeUnit(u) {
    await query(
        `INSERT INTO units (id, building_id, unit_number, floor, rooms,
         square_feet, shares, monthly_maintenance, status, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            u.id, u.building_id, u.unit_number, u.floor, u.rooms,
            u.square_feet, u.shares, u.monthly_maintenance,
            u.status || 'occupied', JSON.stringify(u.details || null),
        ],
    );
}

async function updateUnit(id, u) {
    await query(
        `UPDATE units SET unit_number=?, floor=?, rooms=?, square_feet=?,
         shares=?, monthly_maintenance=?, status=?, details=? WHERE id=?`,
        [
            u.unit_number, u.floor, u.rooms, u.square_feet, u.shares,
            u.monthly_maintenance, u.status, JSON.stringify(u.details || null),
            id,
        ],
    );
}

async function removeUnit(id) {
    await query('DELETE FROM units WHERE id=?', [id]);
}

// ── Residents ──

async function getResidents(filters) {
    let sql = 'SELECT * FROM residents WHERE 1=1';
    const params = [];
    if (filters && filters.unit_id) {
        sql += ' AND unit_id=?';
        params.push(filters.unit_id);
    }
    if (filters && filters.role) {
        sql += ' AND role=?';
        params.push(filters.role);
    }
    sql += ' ORDER BY last_name, first_name';
    const rows = await query(sql, params);
    return rows.map(r => Object.assign({}, r));
}

async function getResident(id) {
    const rows = await query('SELECT * FROM residents WHERE id=?', [id]);
    return rows[0] ? Object.assign({}, rows[0]) : null;
}

async function storeResident(r) {
    await query(
        `INSERT INTO residents (id, unit_id, first_name, last_name, email,
         phone, role, is_primary, move_in_date, shares_held, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            r.id, r.unit_id, r.first_name, r.last_name, r.email, r.phone,
            r.role || 'shareholder', r.is_primary || false, r.move_in_date,
            r.shares_held, JSON.stringify(r.details || null),
        ],
    );
}

async function updateResident(id, r) {
    await query(
        `UPDATE residents SET unit_id=?, first_name=?, last_name=?, email=?,
         phone=?, role=?, is_primary=?, move_in_date=?, move_out_date=?,
         shares_held=?, details=? WHERE id=?`,
        [
            r.unit_id, r.first_name, r.last_name, r.email, r.phone,
            r.role, r.is_primary, r.move_in_date, r.move_out_date,
            r.shares_held, JSON.stringify(r.details || null), id,
        ],
    );
}

async function removeResident(id) {
    await query('DELETE FROM residents WHERE id=?', [id]);
}

// ── Board Members ──

async function getBoardMembers(activeOnly) {
    const sql = activeOnly
        ? `SELECT bm.*, r.first_name, r.last_name, r.email
           FROM board_members bm JOIN residents r ON bm.resident_id=r.id
           WHERE bm.is_active=TRUE
           ORDER BY FIELD(bm.role, 'president','vice_president','treasurer','secretary','member')`
        : `SELECT bm.*, r.first_name, r.last_name, r.email
           FROM board_members bm JOIN residents r ON bm.resident_id=r.id
           ORDER BY bm.is_active DESC, bm.term_start DESC`;
    const rows = await query(sql);
    return rows.map(r => Object.assign({}, r));
}

async function storeBoardMember(bm) {
    await query(
        `INSERT INTO board_members (id, resident_id, role, term_start, term_end, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [bm.id, bm.resident_id, bm.role, bm.term_start, bm.term_end, bm.is_active !== false],
    );
}

async function updateBoardMember(id, bm) {
    await query(
        'UPDATE board_members SET role=?, term_start=?, term_end=?, is_active=? WHERE id=?',
        [bm.role, bm.term_start, bm.term_end, bm.is_active, id],
    );
}

async function removeBoardMember(id) {
    await query('DELETE FROM board_members WHERE id=?', [id]);
}

// ── Announcements ──

async function getAnnouncements() {
    const rows = await query(
        `SELECT a.*, r.first_name, r.last_name FROM announcements a
         LEFT JOIN residents r ON a.posted_by=r.id
         ORDER BY a.posted_at DESC`,
    );
    return rows.map(r => Object.assign({}, r));
}

async function getAnnouncement(id) {
    const rows = await query('SELECT * FROM announcements WHERE id=?', [id]);
    return rows[0] ? Object.assign({}, rows[0]) : null;
}

async function storeAnnouncement(a) {
    await query(
        `INSERT INTO announcements (id, title, body, category, posted_by, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [a.id, a.title, a.body, a.category, a.posted_by, a.expires_at],
    );
}

async function updateAnnouncement(id, a) {
    await query(
        'UPDATE announcements SET title=?, body=?, category=?, expires_at=? WHERE id=?',
        [a.title, a.body, a.category, a.expires_at, id],
    );
}

async function removeAnnouncement(id) {
    await query('DELETE FROM announcements WHERE id=?', [id]);
}

// ── Documents ──

async function getDocuments(category) {
    let sql =
        'SELECT d.*, r.first_name, r.last_name FROM documents d LEFT JOIN residents r ON d.uploaded_by=r.id';
    const params = [];
    if (category) {
        sql += ' WHERE d.category=?';
        params.push(category);
    }
    sql += ' ORDER BY d.uploaded_at DESC';
    const rows = await query(sql, params);
    return rows.map(r => Object.assign({}, r));
}

async function storeDocument(d) {
    await query(
        `INSERT INTO documents (id, title, category, file_path, uploaded_by, details)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [d.id, d.title, d.category, d.file_path, d.uploaded_by, JSON.stringify(d.details || null)],
    );
}

async function getDocument(id) {
    const rows = await query('SELECT * FROM documents WHERE id=?', [id]);
    return rows[0] ? Object.assign({}, rows[0]) : null;
}
async function updateDocument(id, updates) {
    const sets = [];
    const params = [];
    if (updates.analysis_json !== undefined) { sets.push('analysis_json=?'); params.push(updates.analysis_json); }
    if (updates.file_path !== undefined) { sets.push('file_path=?'); params.push(updates.file_path); }
    if (updates.file_size !== undefined) { sets.push('file_size=?'); params.push(updates.file_size); }
    if (updates.mime_type !== undefined) { sets.push('mime_type=?'); params.push(updates.mime_type); }
    if (sets.length === 0) return;
    params.push(id);
    await query(`UPDATE documents SET ${sets.join(', ')} WHERE id=?`, params);
}
async function removeDocument(id) {
    const rows = await query('SELECT * FROM documents WHERE id=?', [id]);
    await query('DELETE FROM documents WHERE id=?', [id]);
    return rows[0] ? Object.assign({}, rows[0]) : null;
}

// ── Maintenance Requests ──

async function getMaintenanceRequests(filters) {
    let sql = `SELECT mr.*, r.first_name, r.last_name, u.unit_number
               FROM maintenance_requests mr
               LEFT JOIN residents r ON mr.submitted_by=r.id
               LEFT JOIN units u ON mr.unit_id=u.id WHERE 1=1`;
    const params = [];
    if (filters && filters.status) {
        sql += ' AND mr.status=?';
        params.push(filters.status);
    }
    if (filters && filters.unit_id) {
        sql += ' AND mr.unit_id=?';
        params.push(filters.unit_id);
    }
    if (filters && filters.submitted_by) {
        sql += ' AND mr.submitted_by=?';
        params.push(filters.submitted_by);
    }
    if (filters && filters.priority) {
        sql += ' AND mr.priority=?';
        params.push(filters.priority);
    }
    sql += ' ORDER BY mr.created_at DESC';
    const rows = await query(sql, params);
    return rows.map(r => Object.assign({}, r));
}

async function getMaintenanceRequest(id) {
    const rows = await query(
        `SELECT mr.*, r.first_name, r.last_name, u.unit_number
         FROM maintenance_requests mr
         LEFT JOIN residents r ON mr.submitted_by=r.id
         LEFT JOIN units u ON mr.unit_id=u.id
         WHERE mr.id=?`,
        [id],
    );
    return rows[0] ? Object.assign({}, rows[0]) : null;
}

async function storeMaintenanceRequest(mr) {
    await query(
        `INSERT INTO maintenance_requests
         (id, unit_id, submitted_by, title, description, location, priority, status, assigned_to)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            mr.id, mr.unit_id, mr.submitted_by, mr.title, mr.description,
            mr.location, mr.priority || 'normal', mr.status || 'open',
            mr.assigned_to,
        ],
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
    sets.push('updated_at=NOW()');
    params.push(id);
    await query(`UPDATE maintenance_requests SET ${sets.join(', ')} WHERE id=?`, params);
}

async function removeMaintenanceRequest(id) {
    await query('DELETE FROM request_comments WHERE request_id=?', [id]);
    await query('DELETE FROM maintenance_requests WHERE id=?', [id]);
}

// ── Request Comments ──

async function getRequestComments(requestId) {
    const rows = await query(
        `SELECT rc.*, r.first_name, r.last_name FROM request_comments rc
         LEFT JOIN residents r ON rc.author_id=r.id
         WHERE rc.request_id=? ORDER BY rc.created_at ASC`,
        [requestId],
    );
    return rows.map(r => Object.assign({}, r));
}

async function storeRequestComment(c) {
    await query(
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
    const rows = await query(sql, params);
    return rows.map(r => Object.assign({}, r));
}

async function storeMaintenanceCharge(mc) {
    await query(
        `INSERT INTO maintenance_charges (id, unit_id, period_month, period_year, amount, status, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [mc.id, mc.unit_id, mc.period_month, mc.period_year, mc.amount, mc.status || 'pending', mc.due_date],
    );
}

async function updateMaintenanceCharge(id, mc) {
    await query('UPDATE maintenance_charges SET status=?, paid_date=? WHERE id=?', [mc.status, mc.paid_date, id]);
}

// ── Assessments ──

async function getAssessments() {
    const rows = await query('SELECT * FROM assessments ORDER BY effective_date DESC');
    return rows.map(r => Object.assign({}, r));
}

async function storeAssessment(a) {
    await query(
        `INSERT INTO assessments (id, title, description, total_amount, per_share_amount, effective_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [a.id, a.title, a.description, a.total_amount, a.per_share_amount, a.effective_date],
    );
}

async function getAssessmentCharges(assessmentId) {
    const rows = await query(
        `SELECT ac.*, u.unit_number, u.shares FROM assessment_charges ac
         JOIN units u ON ac.unit_id=u.id WHERE ac.assessment_id=?
         ORDER BY u.unit_number`,
        [assessmentId],
    );
    return rows.map(r => Object.assign({}, r));
}

async function storeAssessmentCharge(ac) {
    await query(
        'INSERT INTO assessment_charges (id, assessment_id, unit_id, amount, status) VALUES (?, ?, ?, ?, ?)',
        [ac.id, ac.assessment_id, ac.unit_id, ac.amount, ac.status || 'pending'],
    );
}

async function updateAssessmentCharge(id, ac) {
    await query('UPDATE assessment_charges SET status=?, paid_date=? WHERE id=?', [ac.status, ac.paid_date, id]);
}

// ── Users / Auth ──

async function getUserByEmail(email) {
    const rows = await query('SELECT * FROM users WHERE email=?', [email]);
    return rows[0] ? Object.assign({}, rows[0]) : null;
}

async function getUserById(id) {
    const rows = await query('SELECT * FROM users WHERE id=?', [id]);
    return rows[0] ? Object.assign({}, rows[0]) : null;
}

async function storeUser(u) {
    await query(
        'INSERT INTO users (id, email, password_hash, resident_id, role) VALUES (?, ?, ?, ?, ?)',
        [u.id, u.email, u.password_hash, u.resident_id, u.role || 'resident'],
    );
}

async function getUsers() {
    const rows = await query(
        `SELECT u.id, u.email, u.role, u.resident_id, u.created_at,
                r.first_name, r.last_name
         FROM users u LEFT JOIN residents r ON u.resident_id=r.id ORDER BY u.email`,
    );
    return rows.map(r => Object.assign({}, r));
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
    await query(`UPDATE users SET ${sets.join(', ')} WHERE id=?`, params);
}

async function removeUser(id) {
    await query('DELETE FROM users WHERE id=?', [id]);
}

// ── Staff ──

async function getStaff() {
    const rows = await query('SELECT * FROM staff WHERE is_active=TRUE ORDER BY name');
    return rows.map(r => Object.assign({}, r));
}

async function storeStaffMember(s) {
    await query(
        `INSERT INTO staff (id, name, role, phone, email, schedule, is_active, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.id, s.name, s.role, s.phone, s.email, s.schedule, s.is_active !== false, JSON.stringify(s.details || null)],
    );
}

async function updateStaffMember(id, s) {
    await query(
        'UPDATE staff SET name=?, role=?, phone=?, email=?, schedule=?, is_active=?, details=? WHERE id=?',
        [s.name, s.role, s.phone, s.email, s.schedule, s.is_active, JSON.stringify(s.details || null), id],
    );
}

async function removeStaffMember(id) {
    await query('DELETE FROM staff WHERE id=?', [id]);
}

// ── Vendors ──

async function getVendors() {
    const rows = await query('SELECT * FROM vendors ORDER BY trade, company_name');
    return rows.map(r => Object.assign({}, r));
}

async function storeVendor(v) {
    await query(
        `INSERT INTO vendors (id, company_name, contact_name, trade, phone, email, contract_expires, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [v.id, v.company_name, v.contact_name, v.trade, v.phone, v.email, v.contract_expires, JSON.stringify(v.details || null)],
    );
}

async function updateVendor(id, v) {
    await query(
        `UPDATE vendors SET company_name=?, contact_name=?, trade=?, phone=?, email=?,
         contract_expires=?, details=? WHERE id=?`,
        [v.company_name, v.contact_name, v.trade, v.phone, v.email, v.contract_expires, JSON.stringify(v.details || null), id],
    );
}

async function removeVendor(id) {
    await query('DELETE FROM vendors WHERE id=?', [id]);
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
    const rows = await query(sql, params);
    return rows.map(r => Object.assign({}, r));
}

async function getApplication(id) {
    const rows = await query(
        'SELECT a.*, u.unit_number FROM applications a JOIN units u ON a.unit_id=u.id WHERE a.id=?',
        [id],
    );
    return rows[0] ? Object.assign({}, rows[0]) : null;
}

async function storeApplication(a) {
    await query(
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
    await query(`UPDATE applications SET ${sets.join(', ')} WHERE id=?`, params);
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
    const rows = await query(sql, params);
    return rows.map(r => Object.assign({}, r));
}

async function storeWaitlistEntry(w) {
    if (!w.position) {
        const rows = await query(
            'SELECT MAX(position) as maxPos FROM waitlists WHERE type=?',
            [w.type],
        );
        w.position = (rows[0].maxPos || 0) + 1;
    }
    await query(
        'INSERT INTO waitlists (id, type, resident_id, position) VALUES (?, ?, ?, ?)',
        [w.id, w.type, w.resident_id, w.position],
    );
}

async function updateWaitlistEntry(id, w) {
    await query('UPDATE waitlists SET position=?, fulfilled_at=? WHERE id=?', [w.position, w.fulfilled_at, id]);
}

async function removeWaitlistEntry(id) {
    await query('DELETE FROM waitlists WHERE id=?', [id]);
}

// ── Compliance ──

async function getComplianceItems() {
    const rows = await query(
        `SELECT ci.*, v.company_name as vendor_name FROM compliance_items ci
         LEFT JOIN vendors v ON ci.vendor_id=v.id ORDER BY ci.due_date`,
    );
    return rows.map(r => Object.assign({}, r));
}

async function storeComplianceItem(ci) {
    await query(
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
    await query(`UPDATE compliance_items SET ${sets.join(', ')} WHERE id=?`, params);
}

async function removeComplianceItem(id) {
    await query('DELETE FROM compliance_items WHERE id=?', [id]);
}

// ── Packages ──

async function getPackages(filters) {
    let sql = `SELECT p.*, u.unit_number FROM packages p
               LEFT JOIN units u ON p.unit_id=u.id WHERE 1=1`;
    const params = [];
    if (filters && filters.unit_id) { sql += ' AND p.unit_id=?'; params.push(filters.unit_id); }
    if (filters && filters.status) { sql += ' AND p.status=?'; params.push(filters.status); }
    if (filters && filters.source) { sql += ' AND p.source=?'; params.push(filters.source); }
    sql += ' ORDER BY p.received_at DESC';
    const rows = await query(sql, params);
    return rows.map(r => Object.assign({}, r));
}

async function getPackage(id) {
    const rows = await query(
        `SELECT p.*, u.unit_number FROM packages p
         LEFT JOIN units u ON p.unit_id=u.id WHERE p.id=?`, [id],
    );
    return rows[0] ? Object.assign({}, rows[0]) : null;
}

async function storePackage(pkg) {
    await query(
        `INSERT INTO packages (id, unit_id, resident_id, carrier, tracking_number,
         description, status, received_by, source, provider_event_id, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [pkg.id, pkg.unit_id, pkg.resident_id, pkg.carrier, pkg.tracking_number,
         pkg.description, pkg.status || 'arrived', pkg.received_by,
         pkg.source || 'manual', pkg.provider_event_id,
         pkg.details ? JSON.stringify(pkg.details) : null],
    );
}

async function updatePackage(id, pkg) {
    const sets = [];
    const params = [];
    if (pkg.status !== undefined) { sets.push('status=?'); params.push(pkg.status); }
    if (pkg.carrier !== undefined) { sets.push('carrier=?'); params.push(pkg.carrier); }
    if (pkg.tracking_number !== undefined) { sets.push('tracking_number=?'); params.push(pkg.tracking_number); }
    if (pkg.description !== undefined) { sets.push('description=?'); params.push(pkg.description); }
    if (pkg.picked_up_at !== undefined) { sets.push('picked_up_at=?'); params.push(pkg.picked_up_at); }
    if (pkg.resident_id !== undefined) { sets.push('resident_id=?'); params.push(pkg.resident_id); }
    if (sets.length === 0) return;
    params.push(id);
    await query(`UPDATE packages SET ${sets.join(', ')} WHERE id=?`, params);
}

async function removePackage(id) {
    await query('DELETE FROM packages WHERE id=?', [id]);
}

async function getPackageByProviderEventId(eventId) {
    const rows = await query('SELECT * FROM packages WHERE provider_event_id=?', [eventId]);
    return rows[0] ? Object.assign({}, rows[0]) : null;
}

// ── Service Providers ──

async function getServiceProviders() {
    const rows = await query('SELECT * FROM service_providers ORDER BY name');
    return rows.map(r => Object.assign({}, r));
}

async function getServiceProvider(id) {
    const rows = await query('SELECT * FROM service_providers WHERE id=?', [id]);
    return rows[0] ? Object.assign({}, rows[0]) : null;
}

async function getServiceProviderByApiKeyHash(hash) {
    const rows = await query('SELECT * FROM service_providers WHERE api_key_hash=? AND is_active=1', [hash]);
    return rows[0] ? Object.assign({}, rows[0]) : null;
}

async function storeServiceProvider(provider) {
    await query(
        `INSERT INTO service_providers (id, name, provider_type, api_key_hash, is_active, config)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [provider.id, provider.name, provider.provider_type, provider.api_key_hash,
         provider.is_active !== false,
         provider.config ? JSON.stringify(provider.config) : null],
    );
}

async function updateServiceProvider(id, provider) {
    const sets = [];
    const params = [];
    if (provider.name !== undefined) { sets.push('name=?'); params.push(provider.name); }
    if (provider.provider_type !== undefined) { sets.push('provider_type=?'); params.push(provider.provider_type); }
    if (provider.is_active !== undefined) { sets.push('is_active=?'); params.push(provider.is_active); }
    if (provider.config !== undefined) { sets.push('config=?'); params.push(JSON.stringify(provider.config)); }
    if (sets.length === 0) return;
    params.push(id);
    await query(`UPDATE service_providers SET ${sets.join(', ')} WHERE id=?`, params);
}

async function removeServiceProvider(id) {
    await query('DELETE FROM service_providers WHERE id=?', [id]);
}

// ── Violations ──

async function getViolations() {
    const rows = await query('SELECT * FROM violations ORDER BY issued_date DESC');
    return rows.map(r => Object.assign({}, r));
}

async function storeViolation(v) {
    await query(
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
    await query(`UPDATE violations SET ${sets.join(', ')} WHERE id=?`, params);
}

async function removeViolation(id) {
    await query('DELETE FROM violations WHERE id=?', [id]);
}

module.exports = {
    init, teardown,
    // Building
    getBuilding, upsertBuilding,
    // Units
    getUnits, getUnit, storeUnit, updateUnit, removeUnit,
    // Residents
    getResidents, getResident, storeResident, updateResident, removeResident,
    // Board
    getBoardMembers, storeBoardMember, updateBoardMember, removeBoardMember,
    // Announcements
    getAnnouncements, getAnnouncement, storeAnnouncement, updateAnnouncement, removeAnnouncement,
    // Documents
    getDocuments, getDocument, storeDocument, updateDocument, removeDocument,
    // Maintenance requests
    getMaintenanceRequests, getMaintenanceRequest, storeMaintenanceRequest,
    updateMaintenanceRequest, removeMaintenanceRequest,
    // Request comments
    getRequestComments, storeRequestComment,
    // Maintenance charges
    getMaintenanceCharges, storeMaintenanceCharge, updateMaintenanceCharge,
    // Assessments
    getAssessments, storeAssessment, getAssessmentCharges, storeAssessmentCharge, updateAssessmentCharge,
    // Users / Auth
    getUserByEmail, getUserById, storeUser, getUsers, updateUser, removeUser,
    // Staff
    getStaff, storeStaffMember, updateStaffMember, removeStaffMember,
    // Vendors
    getVendors, storeVendor, updateVendor, removeVendor,
    // Applications
    getApplications, getApplication, storeApplication, updateApplication,
    // Waitlists
    getWaitlist, storeWaitlistEntry, updateWaitlistEntry, removeWaitlistEntry,
    // Compliance
    getComplianceItems, storeComplianceItem, updateComplianceItem, removeComplianceItem,
    // Violations
    getViolations, storeViolation, updateViolation, removeViolation,
    // Packages
    getPackages, getPackage, storePackage, updatePackage, removePackage, getPackageByProviderEventId,
    // Service Providers
    getServiceProviders, getServiceProvider, getServiceProviderByApiKeyHash,
    storeServiceProvider, updateServiceProvider, removeServiceProvider,
};
