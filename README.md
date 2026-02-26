# Apty

Co-op building management platform. Empowers people to manage their homes and communities.

## Getting Started

### Local development (SQLite)

```bash
npm install
npm run seed   # seed with sample building data
npm run dev    # start with auto-reload at http://localhost:3000
```

Default login: `admin@250w82.com` / `admin123`

### Docker / MySQL

```bash
docker compose up -d
docker compose exec app node src/persistence/seed.js
```

## Stack

| Layer | Technology |
|---|---|
| Frontend | React (Babel in-browser), Bootstrap 4, Chart.js |
| Backend | Node.js / Express |
| Database | SQLite (dev) / MySQL (prod via Docker) |
| AI | Google Gemini (`gemini-3-flash-preview`) |
| File uploads | Multer |
| Auth | Express sessions + PBKDF2 password hashing |

## Project layout

```
src/
  index.js                  Express app entry point
  routes/                   API routers (one file per resource)
  middleware/
    auth.js                 Session + requirePermission()
    auditLog.js             Mutation audit middleware
    logger.js               Request logger
  services/
    documentAnalysis.js     PDF text extraction + Gemini structured analysis
    maintenanceTriage.js    Gemini maintenance request auto-classification
  persistence/
    sqlite.js               SQLite persistence layer
    mysql.js                MySQL persistence layer (prod)
    migrations/             Numbered .sql files applied on startup
    seed.js                 Dev seed script
  static/js/app.js          React SPA (single file, Babel transpiled in-browser)
  auth/permissions.js       Permission strings and role mappings

spec/
  middleware/               Unit tests for middleware
  routes/                   Unit tests for route handlers (mocked DB)
  services/                 Unit tests for services (mocked externals)
  integration/              Integration tests (real server + SQLite + Puppeteer)
    helpers/
      server.js             Starts a test server on port 0 with an isolated DB
      browser.js            Puppeteer helpers (isolated browser contexts per page)
      seed.js               User seeding helper
      login.js              Login/logout UI helpers

scripts/
  run-integration-tests.sh  Runs integration suite; tees output to /tmp/apty-integration.log
data/                       SQLite DB files (gitignored)
```

## API

All routes under `/api/`:

| Resource | Base path | Notes |
|---|---|---|
| Auth | `/api/auth` | login, logout, me |
| Building | `/api/building` | |
| Units | `/api/units` | |
| Residents | `/api/residents` | audited |
| Board | `/api/board` | |
| Announcements | `/api/announcements` | |
| Documents | `/api/documents` | upload, AI analysis |
| Maintenance | `/api/maintenance` | AI triage, audited |
| Finances | `/api/finances` | charges + assessments, audited |
| Staff | `/api/staff` | |
| Vendors | `/api/vendors` | |
| Applications | `/api/applications` | |
| Waitlists | `/api/waitlists` | |
| Compliance | `/api/compliance` | |
| Packages | `/api/packages` | |
| Service providers | `/api/providers` | plugin API |
| Audit log | `/api/audit` | admin only |
| Feedback | `/api/feedback` | screenshot capture |
| ButterflyMX webhook | `/api/integrations/butterflymx` | HMAC-verified |

### Packages

```
GET    /api/packages?unit_id=&status=&source=   list (filterable)
POST   /api/packages                             log manually
PUT    /api/packages/:id                         update status
DELETE /api/packages/:id
```

Statuses: `arrived` → `notified` → `picked_up`

### Service provider plugin API

External systems register as providers and push normalized events:

```
POST /api/providers              register (returns one-time api_key)
POST /api/providers/events       push event (X-Provider-Key header)
```

`package.arrived` event payload:
```json
{
  "event_type": "package.arrived",
  "event_id": "dedup-id",
  "data": { "unit_number": "3B", "carrier": "UPS", "tracking_number": "1Z..." }
}
```

### ButterflyMX

`POST /api/integrations/butterflymx/webhook` — validates HMAC-SHA256 (`X-ButterflyMX-Signature`), maps payload to package record, deduplicates by `event_id`. Configure `webhook_secret` in the provider's config JSON.

## AI features

**Document analysis** — Upload a PDF then `POST /api/documents/:id/analyze`. Gemini extracts a structured summary, highlights, and Chart.js configs stored as `analysis_json`.

**Maintenance triage** — Fire-and-forget Gemini call on every new maintenance request. Classifies into `category`, `suggested_priority`, `vendor_type`, `summary`, `urgency_reason` and stores the result as `triage_json`.

Both features require `GEMINI_API_KEY` and degrade gracefully when absent.

## Audit log

Mutations on residents, documents, maintenance, and finances are automatically recorded in the `audit_log` table via the `auditLog` middleware (`src/middleware/auditLog.js`). Viewable at `GET /api/audit` (admin only, supports `?resource_type=` and `?limit=` filters).

## Testing

```bash
# Unit tests (~0.5 s)
npx jest

# Integration tests — real server + SQLite + Puppeteer (~15 s parallel)
npm run test:integration

# Wrapper script (tees output to /tmp/apty-integration.log)
bash scripts/run-integration-tests.sh
```

### Test pyramid

```
        ▲
       /E2E\          ~10 tests   auth flow, upload UI, role-based nav (Puppeteer)
      /------\
     /  Integ \       ~73 tests   per-resource API suites — real server + SQLite
    /----------\
   /    Unit    \     ~37 tests   services, middleware, route handlers — mocked
  /--------------\
```

| Suite | File | Tests |
|---|---|---|
| Unit | `spec/middleware/auditLog.spec.js` | 8 |
| Unit | `spec/services/maintenanceTriage.spec.js` | 11 |
| Unit | `spec/services/documentAnalysis.spec.js` | 8 |
| Unit | `spec/routes/documents.spec.js` | 10 |
| Integration | `spec/integration/audit.integration.spec.js` | 12 |
| Integration | `spec/integration/dashboard.integration.spec.js` | 9 |
| Integration | `spec/integration/documents.integration.spec.js` | 8 |
| Integration | `spec/integration/finances.integration.spec.js` | 12 |
| Integration | `spec/integration/maintenance.integration.spec.js` | 11 |
| Integration | `spec/integration/residents.integration.spec.js` | 9 |
| Integration | `spec/integration/triage.integration.spec.js` | 4 |
| Integration | `spec/integration/auth.integration.spec.js` | 5 |
| E2E | `spec/integration/documents-ui.integration.spec.js` | 6 |
| E2E | `spec/integration/document-analyze.integration.spec.js` | 4 |

Integration tests run in parallel — each Jest worker gets an OS-assigned port and an isolated SQLite DB.

## Environment variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key (AI features disabled if absent) |
| `SQLITE_DB` | SQLite DB path (default: `data/apty.db`) |
| `SESSION_SECRET` | Express session secret |
| `PORT` | Server port (default: 3000) |
