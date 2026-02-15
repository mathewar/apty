# Apty Co-op Building Implementation Plan

An incremental plan for turning Apty into a working platform for a single co-op building (e.g., 250 W 82nd St). Each phase is independently deployable and useful on its own.

---

## Guiding Principles

- **Single-building first.** No multi-building abstractions until a single building works well.
- **Deploy after every phase.** Each phase ends with a working, testable system.
- **Use the `details` JSON column** for extensible data before committing to new columns/tables.
- **Keep the Docker Compose workflow.** One `docker-compose up` to run everything.
- **Migrate the schema forward.** Add a lightweight migration system early so the database can evolve without wiping data.

---

## Phase 0 — Foundation Cleanup (Week 1)

Get the existing codebase into a state that can support real features.

### 0.1 Schema migrations
- Add a `migrations` table and a runner that applies numbered SQL files on startup.
- Move the current `CREATE TABLE homes` statement into `001_create_homes.sql`.
- Run migrations in `db.init()` before the app listens.

### 0.2 Upgrade Node and dependencies
- Update `docker-compose.yml` from `node:12-alpine` to `node:18-alpine`.
- Update `package.json` dependencies (express, jest, uuid, etc.) to current versions.
- Switch from `uuid/v4` require style to `const { v4: uuidv4 } = require('uuid')`.

### 0.3 Add seed data script
- Create `src/persistence/seed.js` that populates a building with sample units when run against an empty database.
- Add `"seed": "node src/persistence/seed.js"` script to `package.json`.

### 0.4 Basic error handling
- Wrap all route handlers in a try/catch that returns 500 with a JSON error body.
- Add a simple request logger middleware (method, path, status, duration).

**Deployable result:** Same app as before, but with migration infrastructure and better dev ergonomics.

---

## Phase 1 — Building & Units (Weeks 2-3)

Replace the generic "homes" concept with a real building-and-units model.

### 1.1 Database schema

```sql
-- 002_create_building.sql
CREATE TABLE building (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,          -- "250 West 82nd Street"
  address VARCHAR(255),
  city VARCHAR(100) DEFAULT 'New York',
  state VARCHAR(2) DEFAULT 'NY',
  zip VARCHAR(10),
  year_built INT,
  total_floors INT,
  total_units INT,
  building_type VARCHAR(20) DEFAULT 'coop',  -- coop | condo | rental
  details JSON
);

-- 003_create_units.sql
CREATE TABLE units (
  id VARCHAR(36) PRIMARY KEY,
  building_id VARCHAR(36) NOT NULL,
  unit_number VARCHAR(20) NOT NULL,     -- "4A", "PH1"
  floor INT,
  rooms DECIMAL(3,1),                   -- 3.5 rooms (NYC style)
  square_feet INT,
  shares INT,                           -- co-op shares allocated to this unit
  monthly_maintenance DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'occupied', -- occupied | vacant | renovating
  details JSON,
  FOREIGN KEY (building_id) REFERENCES building(id)
);
```

### 1.2 API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/building` | Get the building info (single building, so no ID needed) |
| PUT | `/api/building` | Update building info |
| GET | `/api/units` | List all units |
| GET | `/api/units/:id` | Get a single unit |
| POST | `/api/units` | Add a unit |
| PUT | `/api/units/:id` | Update a unit |
| DELETE | `/api/units/:id` | Remove a unit |

- Prefix all new routes with `/api/` to separate from the static file serving.
- Keep the old `/items` routes temporarily for backward compatibility; remove in Phase 2.

### 1.3 Persistence layer refactor
- Add `building.js` and `units.js` modules under `src/persistence/`.
- Each module exports its own CRUD functions.
- `src/persistence/index.js` aggregates and re-exports all modules.

### 1.4 Frontend — Building dashboard
- Replace the current todo-list UI with a building overview page.
- Show: building name, address, total units, total shares.
- List all units in a table: unit number, floor, rooms, shares, maintenance, status.
- Add/edit unit forms.

### 1.5 Seed data for 250 W 82nd St
- Update the seed script to create the building record and ~20-30 sample units with realistic data.

**Deployable result:** A building dashboard showing units with co-op share allocations and maintenance amounts.

---

## Phase 2 — Residents & Shareholders (Weeks 4-5)

Model the people who live in and own shares of the building.

### 2.1 Database schema

```sql
-- 004_create_residents.sql
CREATE TABLE residents (
  id VARCHAR(36) PRIMARY KEY,
  unit_id VARCHAR(36) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(20) DEFAULT 'shareholder',  -- shareholder | subtenant | occupant
  is_primary BOOLEAN DEFAULT FALSE,        -- primary contact for the unit
  move_in_date DATE,
  move_out_date DATE,
  shares_held INT,                          -- may differ from unit shares if co-owned
  details JSON,
  FOREIGN KEY (unit_id) REFERENCES units(id)
);
```

### 2.2 API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/residents` | List all residents (filterable by unit_id, role) |
| GET | `/api/residents/:id` | Get a single resident |
| POST | `/api/residents` | Add a resident |
| PUT | `/api/residents/:id` | Update a resident |
| DELETE | `/api/residents/:id` | Remove a resident |
| GET | `/api/units/:id/residents` | List residents for a specific unit |

### 2.3 Frontend
- Unit detail view showing who lives there.
- Resident directory page (searchable, sortable).
- Add/edit resident forms.

**Deployable result:** A building directory where you can see who lives in each unit, their role, and their share ownership.

---

## Phase 3 — Board & Governance (Weeks 6-7)

### 3.1 Database schema

```sql
-- 005_create_board.sql
CREATE TABLE board_members (
  id VARCHAR(36) PRIMARY KEY,
  resident_id VARCHAR(36) NOT NULL,
  role VARCHAR(50) NOT NULL,             -- president | vice_president | treasurer | secretary | member
  term_start DATE,
  term_end DATE,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (resident_id) REFERENCES residents(id)
);

-- 006_create_documents.sql
CREATE TABLE documents (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,         -- house_rules | minutes | financial | notice | lease | bylaws
  file_path VARCHAR(500),               -- path to stored file
  uploaded_by VARCHAR(36),
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  details JSON,
  FOREIGN KEY (uploaded_by) REFERENCES residents(id)
);

-- 007_create_announcements.sql
CREATE TABLE announcements (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  category VARCHAR(50),                  -- general | maintenance | meeting | emergency
  posted_by VARCHAR(36),
  posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (posted_by) REFERENCES residents(id)
);
```

### 3.2 API endpoints
- CRUD for `/api/board` — board member management.
- CRUD for `/api/documents` — upload, list, download building documents.
- CRUD for `/api/announcements` — building-wide notices.

### 3.3 File storage
- Store uploaded documents on the local filesystem under a `data/documents/` volume.
- Add a Docker volume mount for persistence.
- Use `multer` middleware for file uploads.

### 3.4 Frontend
- Board page — list current board members and their roles.
- Documents page — browse by category, download files.
- Announcements feed on the dashboard — latest notices at the top.

**Deployable result:** Board info visible, building documents browsable, announcements posted and displayed on the dashboard.

---

## Phase 4 — Maintenance Requests (Weeks 8-9)

The single most useful operational feature for residents.

### 4.1 Database schema

```sql
-- 008_create_maintenance_requests.sql
CREATE TABLE maintenance_requests (
  id VARCHAR(36) PRIMARY KEY,
  unit_id VARCHAR(36),                    -- NULL for common area issues
  submitted_by VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(100),                  -- "Kitchen", "Lobby", "Roof"
  priority VARCHAR(20) DEFAULT 'normal',  -- low | normal | high | emergency
  status VARCHAR(20) DEFAULT 'open',      -- open | in_progress | waiting_parts | resolved | closed
  assigned_to VARCHAR(100),               -- staff name or vendor
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  details JSON,
  FOREIGN KEY (unit_id) REFERENCES units(id),
  FOREIGN KEY (submitted_by) REFERENCES residents(id)
);

-- 009_create_request_comments.sql
CREATE TABLE request_comments (
  id VARCHAR(36) PRIMARY KEY,
  request_id VARCHAR(36) NOT NULL,
  author_id VARCHAR(36),
  body TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES maintenance_requests(id),
  FOREIGN KEY (author_id) REFERENCES residents(id)
);
```

### 4.2 API endpoints
- CRUD for `/api/maintenance` — create, list (filterable by status/unit/priority), update status.
- CRUD for `/api/maintenance/:id/comments` — threaded comments on a request.

### 4.3 Frontend
- Submit a maintenance request form (unit auto-selected, title, description, location, priority).
- List view with filters: my requests, all open, by status.
- Detail view with status timeline and comment thread.

**Deployable result:** Residents can submit and track maintenance requests; building staff can update status and respond.

---

## Phase 5 — Financials (Weeks 10-12)

### 5.1 Database schema

```sql
-- 010_create_finances.sql
CREATE TABLE maintenance_charges (
  id VARCHAR(36) PRIMARY KEY,
  unit_id VARCHAR(36) NOT NULL,
  period_month INT NOT NULL,             -- 1-12
  period_year INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',  -- pending | paid | late | waived
  due_date DATE,
  paid_date DATE,
  details JSON,
  FOREIGN KEY (unit_id) REFERENCES units(id)
);

CREATE TABLE assessments (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  total_amount DECIMAL(12,2),
  per_share_amount DECIMAL(10,4),        -- assessment divided by shares
  effective_date DATE,
  details JSON
);

CREATE TABLE assessment_charges (
  id VARCHAR(36) PRIMARY KEY,
  assessment_id VARCHAR(36) NOT NULL,
  unit_id VARCHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  paid_date DATE,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id),
  FOREIGN KEY (unit_id) REFERENCES units(id)
);
```

### 5.2 API endpoints
- GET/POST `/api/finances/maintenance-charges` — generate monthly charges for all units, list charges.
- GET `/api/finances/maintenance-charges?unit_id=X` — a unit's payment history.
- CRUD `/api/finances/assessments` — special assessments.
- POST `/api/finances/assessments/:id/generate` — auto-generate per-unit charges based on shares.

### 5.3 Frontend
- **For board/treasurer:** Monthly charge generation, payment tracking, arrears report.
- **For residents:** View my charges, payment history, outstanding balance.
- Assessment notices with per-unit breakdown.

**Deployable result:** Monthly maintenance billing tracked per unit, special assessments generated proportional to shares.

---

## Phase 6 — Authentication & Roles (Weeks 13-14)

Until now, the app is open (suitable for a trusted single-building deploy behind a private network). This phase adds real access control.

### 6.1 Implementation
- Add `users` table (id, email, password_hash, resident_id, role).
- Roles: `admin` (board), `staff`, `resident`, `readonly`.
- Use `bcrypt` for password hashing, `express-session` with `connect-session-knex` or a MySQL session store.
- Session-based auth (simpler to deploy than JWT for a single-building app).
- Login page, session middleware on all `/api/` routes.

### 6.2 Route protection
- Middleware that checks `req.session.user` and `req.session.role`.
- Admin-only: building settings, user management, financial management, board management.
- Resident: own unit info, submit maintenance requests, view announcements/documents.
- Staff: maintenance request management.

### 6.3 Frontend
- Login page.
- Navigation changes based on role.
- "My Unit" view for residents.

**Deployable result:** Secure, role-based access. Residents log in and see their own unit; board members see everything.

---

## Phase 7 — Building Operations & Vendors (Weeks 15-16)

### 7.1 Database schema

```sql
CREATE TABLE staff (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100),                     -- superintendent | porter | doorman | handyman
  phone VARCHAR(20),
  email VARCHAR(255),
  schedule VARCHAR(255),                 -- "Mon-Fri 8am-4pm"
  is_active BOOLEAN DEFAULT TRUE,
  details JSON
);

CREATE TABLE vendors (
  id VARCHAR(36) PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  trade VARCHAR(100),                    -- plumbing | electrical | elevator | exterminator | HVAC
  phone VARCHAR(20),
  email VARCHAR(255),
  contract_expires DATE,
  details JSON
);
```

### 7.2 Features
- Staff directory with contact info and schedules.
- Vendor directory with trade categories and contract dates.
- Link maintenance requests to vendors when outside help is needed.

**Deployable result:** One place to find the super's number, the plumber's contact, and when the elevator contract expires.

---

## Phase 8 — Co-op Transactions (Weeks 17-18)

Features specific to co-op ownership transfers.

### 8.1 Database schema

```sql
CREATE TABLE applications (
  id VARCHAR(36) PRIMARY KEY,
  unit_id VARCHAR(36) NOT NULL,
  type VARCHAR(20) NOT NULL,             -- purchase | sublet | alteration
  applicant_name VARCHAR(255),
  applicant_email VARCHAR(255),
  status VARCHAR(30) DEFAULT 'submitted', -- submitted | under_review | interview_scheduled | approved | denied | withdrawn
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  board_decision VARCHAR(20),
  notes TEXT,
  details JSON,
  FOREIGN KEY (unit_id) REFERENCES units(id)
);

CREATE TABLE waitlists (
  id VARCHAR(36) PRIMARY KEY,
  type VARCHAR(50) NOT NULL,             -- parking | storage | laundry | garage
  resident_id VARCHAR(36) NOT NULL,
  position INT,
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  fulfilled_at DATETIME,
  FOREIGN KEY (resident_id) REFERENCES residents(id)
);
```

### 8.2 Features
- **Board application tracker:** Purchase/sublet applications flow through status stages.
- **Flip tax calculator:** Configurable percentage, calculates fee on sale price.
- **Waitlists:** Residents join waitlists for parking, storage, etc. Board manages the queue.

**Deployable result:** Board tracks purchase and sublet applications through the approval pipeline; residents can join building waitlists.

---

## Phase 9 — NYC Compliance Tracking (Weeks 19-20)

### 9.1 Database schema

```sql
CREATE TABLE compliance_items (
  id VARCHAR(36) PRIMARY KEY,
  law_name VARCHAR(255) NOT NULL,        -- "Local Law 11", "Local Law 97"
  description TEXT,
  due_date DATE,
  status VARCHAR(30) DEFAULT 'upcoming', -- upcoming | in_progress | completed | overdue
  vendor_id VARCHAR(36),
  cost DECIMAL(12,2),
  notes TEXT,
  details JSON,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

CREATE TABLE violations (
  id VARCHAR(36) PRIMARY KEY,
  source VARCHAR(50) NOT NULL,           -- HPD | DOB | FDNY | DEP
  violation_number VARCHAR(100),
  description TEXT,
  issued_date DATE,
  status VARCHAR(30) DEFAULT 'open',     -- open | correcting | dismissed | closed
  penalty DECIMAL(10,2),
  details JSON
);
```

### 9.2 Features
- Compliance dashboard: upcoming deadlines, overdue items flagged.
- Violation tracker: log violations, track resolution.
- Pre-populated templates for common NYC building laws (LL11 facade, LL97 emissions, LL152 gas piping, fire safety).

**Deployable result:** Board sees a compliance calendar and can track violations in one place.

---

## Deployment Architecture (Single Building)

The entire system runs on a single server with Docker Compose. This is intentionally simple — a co-op board should be able to run this on a $10/month VPS.

```
docker-compose.yml
├── app        (Node 18 Alpine, port 3000)
├── mysql      (MySQL 8, persistent volume)
└── nginx      (reverse proxy, SSL termination) ← added in Phase 6
```

### Deployment additions by phase:
- **Phase 0-5:** `docker-compose up` works as-is. Access via `http://localhost:3000`.
- **Phase 6:** Add nginx service for HTTPS. Add `certbot` for Let's Encrypt. Set `SESSION_SECRET` env var.
- **Phase 7+:** Add a `data/documents` volume for file uploads.

### Backup strategy (add in Phase 1):
- Add a `backup.sh` script that runs `mysqldump` and copies the documents volume.
- Add a cron example for nightly backups.

---

## File Structure After All Phases

```
src/
├── index.js                  # Express app, middleware, route registration
├── middleware/
│   ├── auth.js               # Session auth (Phase 6)
│   ├── errorHandler.js       # Central error handling (Phase 0)
│   └── logger.js             # Request logger (Phase 0)
├── persistence/
│   ├── index.js              # DB selection (mysql/sqlite)
│   ├── mysql.js              # Connection pool & migration runner
│   ├── migrations/           # Numbered SQL files
│   │   ├── 001_create_homes.sql
│   │   ├── 002_create_building.sql
│   │   ├── 003_create_units.sql
│   │   └── ...
│   ├── seed.js               # Sample data for dev/demo
│   ├── building.js           # Building queries
│   ├── units.js              # Unit queries
│   ├── residents.js          # Resident queries
│   ├── maintenance.js        # Maintenance request queries
│   ├── finances.js           # Financial queries
│   ├── documents.js          # Document queries
│   └── ...
├── routes/
│   ├── building.js           # /api/building
│   ├── units.js              # /api/units
│   ├── residents.js          # /api/residents
│   ├── board.js              # /api/board
│   ├── announcements.js      # /api/announcements
│   ├── documents.js          # /api/documents
│   ├── maintenance.js        # /api/maintenance
│   ├── finances.js           # /api/finances
│   ├── applications.js       # /api/applications
│   ├── compliance.js         # /api/compliance
│   └── auth.js               # /api/auth (Phase 6)
├── static/
│   ├── index.html
│   ├── js/
│   │   └── app.js            # React SPA
│   └── css/
│       └── styles.css
└── scripts/
    ├── backup.sh
    └── restore.sh
```

---

## Summary: What Ships When

| Phase | What the board/residents can do | Effort |
|-------|-------------------------------|--------|
| 0 | (Dev infra only) | 1 week |
| 1 | See building info and all units with shares/maintenance | 2 weeks |
| 2 | Look up who lives where, resident directory | 2 weeks |
| 3 | Read announcements, download house rules, see board members | 2 weeks |
| 4 | Submit and track maintenance requests | 2 weeks |
| 5 | View maintenance charges, payment tracking | 3 weeks |
| 6 | Log in securely, see only what's relevant to your role | 2 weeks |
| 7 | Find staff/vendor contacts | 2 weeks |
| 8 | Track purchase/sublet applications, join waitlists | 2 weeks |
| 9 | Compliance calendar, violation tracking | 2 weeks |

**Total: ~20 weeks to a fully featured co-op management platform.**

Phases 0-4 alone (8 weeks) give you a usable building dashboard with unit management, a resident directory, announcements, and maintenance requests — enough for a co-op board to start getting value immediately.
