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

---

## Product Roadmap

The items below represent what is needed to make Apty production-ready for a first real NYC co-op building. They are grouped by theme and ordered by priority within each phase.

---

### Phase 1 — Ship blockers
> Must be done before any real building goes live.

#### Notifications
- [ ] **Email delivery service** — Integrate SendGrid or AWS SES. All significant events (package arrival, maintenance status change, payment due, emergency announcement) need to send email to the relevant resident(s). Currently nothing is sent.
- [ ] **SMS alerts for emergencies** — Twilio or similar for building-wide emergency notifications (water shut-off, fire alarm, etc.) where email is too slow.
- [ ] **Package arrival notification** — When a package status moves to `arrived`, automatically notify the resident by email/SMS.
- [ ] **Maintenance status notifications** — Email the submitting resident when their request moves to `in_progress` or `resolved`, and when work is scheduled.
- [ ] **Payment reminders** — Automated reminder emails before and after the monthly maintenance due date.

#### Payments
- [ ] **Online maintenance payment (ACH/card)** — Integrate Stripe or Dwolla so residents can pay their monthly maintenance charge directly from the portal. "Mark paid" should remain for cash/check but online payment should be the default path.
- [ ] **Payment history for residents** — Residents need a clear view of all charges, payments, and outstanding balances for their unit, including receipts.
- [ ] **Late fee automation** — Configurable grace period and flat/percentage late fee applied automatically after the due date passes.

#### Resident portal
- [ ] **Separate resident UI** — Residents currently see the same interface as admins. The resident view should be scoped: their unit's charges, their maintenance requests, their packages, building announcements, and shared documents. Admin pages (audit log, users, all-unit financials) must not be accessible.
- [ ] **Resident self-service maintenance submission** — Residents submit requests with a description and optional photo. They can view and comment on their own open requests.
- [ ] **Resident document access** — Residents can download building-wide documents (house rules, minutes, policies) and their own unit-specific documents (proprietary lease, alteration agreements).

#### Infrastructure
- [ ] **Cloud file storage (S3 or equivalent)** — Uploaded documents are currently written to the local filesystem. This means data loss on any server move or restart. All uploads must be stored in object storage with a configurable bucket.
- [ ] **Automated database backups** — Daily backups with at least 30-day retention. The building's financial and legal records cannot be recreated if lost.
- [ ] **HTTPS / TLS setup guide** — Document how to run behind a reverse proxy (nginx + Let's Encrypt). The app must not be run over HTTP in production.
- [ ] **Two-factor authentication** — TOTP (Google Authenticator / Authy) for admin accounts at minimum. The system holds financial records and personal data.

---

### Phase 2 — Core co-op operations
> Required for the building to actually run day-to-day on the platform.

#### Financial management
- [ ] **Annual operating budget** — Create and approve a line-item budget for the fiscal year. Track actual spend vs. budget per category throughout the year.
- [ ] **Reserve fund tracking** — The reserve fund is a separate account from operating. Track balance, contributions, and withdrawals. Many NYC co-ops are required by lenders to maintain a minimum reserve.
- [ ] **Accounts payable** — Record and track vendor invoices and payments. Link payments to vendors and maintenance work orders. Generate 1099 data for contractors paid over $600/year.
- [ ] **Special assessment billing UI** — The assessment schema exists in the database but there is no UI. Boards need to create special assessments (e.g. Local Law 11 work), allocate per share, and bill residents.
- [ ] **Financial statements** — Monthly P&L (income vs. expenses) and balance sheet. These are reviewed at every board meeting and required by shareholders on request.
- [ ] **Flip tax ledger** — Record flip taxes collected on unit sales. Most NYC co-ops charge 1–3% of the sale price or a per-share amount. This is a significant revenue source.
- [ ] **Underlying mortgage tracking** — Most NYC co-ops carry a blanket building mortgage. Track lender, current balance, interest rate, monthly payment, and maturity date. Surface the per-share allocation for shareholder tax deduction letters.
- [ ] **Year-end shareholder tax letters** — Generate the annual letter showing each shareholder's share of deductible mortgage interest and real estate taxes (required for Schedule A / Form 1098).

#### NYC compliance (pre-loaded templates)
- [ ] **Local Law 11 / FISP** — Facade Inspection Safety Program. 5-year cycle for buildings 6+ stories. Pre-load with due date calculator, required filings (QEWI report, SWARMP/UNSAFE classifications), and penalty warnings.
- [ ] **Local Law 97** — Carbon emission limits with financial penalties starting 2024, escalating through 2030. Pre-load the building's applicable caps and track toward the penalty threshold.
- [ ] **Local Law 84** — Annual energy benchmarking via ENERGY STAR Portfolio Manager. Track submission deadline (May 1) and benchmark score year-over-year.
- [ ] **Local Law 87** — Energy audit and retro-commissioning every 10 years for buildings over 50,000 sq ft. Track due year and filing.
- [ ] **Annual inspections checklist** — Pre-populate recurring compliance items: boiler inspection (annual, DOB), elevator inspection and certification (annual), fire alarm/sprinkler inspection, standpipe, backflow preventer, cooling tower registration.
- [ ] **Lead paint (Local Law 1)** — Annual turnover inspections for units with children under 6. Track inspections per unit.
- [ ] **Mold (Local Law 55)** — Track mold investigations and remediation records.
- [ ] **HPD/DOB violation auto-import** — Pull open violations for the building's BBL from NYC Open Data on a scheduled basis and create compliance items automatically.

#### Meeting management
- [ ] **Board meeting records** — Create meetings with date, location, and agenda. Record attendance and whether quorum was met.
- [ ] **Meeting minutes** — Structured minutes template with motions, votes, and resolutions. Minutes are stored as documents and can be distributed to shareholders.
- [ ] **Annual shareholder meeting** — Special meeting type for the AGM. Track proxy forms received, quorum, and officer elections.
- [ ] **Board resolution log** — Searchable record of all formal board resolutions (policy changes, vendor approvals, special assessments, etc.).

#### Maintenance upgrades
- [ ] **Photo attachments on requests** — Residents and staff should be able to attach photos to maintenance requests. Critical for insurance claims and contractor briefings.
- [ ] **Work order scheduling** — When a request is assigned to a vendor, record the scheduled date/time and notify the resident. Track actual completion date and cost.
- [ ] **Preventive maintenance calendar** — Recurring scheduled tasks (HVAC filter replacement, boiler service, pest control, gutter cleaning, etc.) with auto-generated work orders.
- [ ] **Vendor COI verification** — Before any contractor works in the building, a current Certificate of Insurance must be on file. Track COI expiry dates and block scheduling if expired.
- [ ] **Maintenance cost tracking** — Link labor and material costs to each work order. Feed into the operating budget and financial statements.

#### Move management
- [ ] **Move permit system** — Residents request elevator reservations for moves. Board/super approves or suggests an alternative slot. Enforce the building's move-in/out hours policy.
- [ ] **Move-in/out fee collection** — Many NYC co-ops charge a refundable deposit and/or non-refundable move fee. Collect via the payment integration and track refund status.
- [ ] **Pre/post move inspection** — Checklist to record the condition of common areas (elevator, lobby, hallway) before and after a move. Associate with the unit and resident record.

---

### Phase 3 — Governance and legal
> NYC co-op-specific legal structures that distinguish co-ops from rentals or condos.

#### Proprietary lease and share registry
- [ ] **Proprietary lease records** — Each shareholder holds a proprietary lease (the document that gives them the right to occupy their unit). Track lease date, original lessee, any amendments, subletting consent history, and store the signed PDF.
- [ ] **Share certificate registry** — Record each shareholder's share certificate number(s), number of shares, issuance date, and transfer history. This is the legal ownership record of the co-op.
- [ ] **Recognition agreement tracking** — When a shareholder finances their purchase, the lender requires a recognition agreement from the co-op. Track executed agreements per unit, lender name, and expiration.

#### Purchase and sublet workflow
- [ ] **Board package checklist** — NYC co-op board packages require 2 years of tax returns, 3 months of bank statements, employer letter, recommendation letters, and more. Replace the basic application form with a structured document checklist and status tracker.
- [ ] **Board interview scheduling** — Automatically schedule interviews when a package is approved for review. Send calendar invites to board members and applicants.
- [ ] **Waiver of right of first refusal** — NYC co-ops must formally waive (or exercise) the right of first refusal on sales. Track and generate the waiver letter.
- [ ] **Sublet fee billing** — Sublet fees (typically 10–25% of monthly maintenance) must be charged to subletting shareholders annually. Calculate and bill via the finances module.
- [ ] **Sublet cap enforcement** — Most co-ops limit the percentage of units that can be sublet at any time (e.g. 20%). Surface a warning when the building is approaching its cap during application review.
- [ ] **Sublet renewal tracking** — Sublease terms must be renewed with board approval, typically annually. Track expiry dates and send advance reminders.

#### Tax and regulatory
- [ ] **Cooperative-Condominium Tax Abatement (CCTA)** — NYC co-ops receive an annual property tax abatement passed through to qualifying shareholders. Track abatement amounts per unit and apply as a credit on maintenance charges.
- [ ] **421-a / J-51 benefit tracking** — Some buildings carry expiring tax benefit programs. Track program type, expiry year, and impact on taxes per unit.
- [ ] **STAR exemption records** — Track which shareholders have applied for the School Tax Assessment Relief exemption and their benefit amounts.

---

### Phase 4 — Operations enhancements
> Operational detail that improves day-to-day life once the core is running.

#### Building assets
- [ ] **Parking and storage assignment** — Track which parking spot(s) and storage cage(s) are assigned to each unit, monthly fees, and any waitlist for unassigned spots.
- [ ] **Key and fob registry** — Record every key and fob issued: type, unit, resident name, issue date. Track returns on move-out.
- [ ] **Pet registry** — Most NYC co-ops require board approval for pets. Track approved pets (name, breed, weight) per unit with approval date and any conditions.
- [ ] **Bicycle storage** — Track registered bicycles and storage room / cage assignments.

#### Resident services
- [ ] **Amenity booking** — Residents reserve shared amenities (rooftop, gym, party room, laundry room, children's room) via a simple calendar. Enforce time limits and capacity rules.
- [ ] **Contractor / visitor access log** — Log when contractors and delivery personnel enter the building. Link to work orders where applicable. Required for insurance and security.
- [ ] **Direct messaging (resident ↔ management)** — Residents message the super or managing agent directly within the platform, keeping a searchable thread rather than relying on personal email.
- [ ] **Emergency contact registry** — Per-unit emergency contacts (not necessarily residents) who can be reached if the shareholder is unreachable.

#### Document management upgrades
- [ ] **E-signature integration** — Alteration agreements, sublet consent letters, and house rules acknowledgments require signatures. Integrate DocuSign or HelloSign so documents can be sent and signed within the platform.
- [ ] **Document templates** — Pre-built templates for common NYC co-op documents: alteration agreement, sublet agreement, move-in/out rules acknowledgment, house rules, proprietary lease addendum.
- [ ] **Targeted document sharing** — Share a document with a specific unit or resident (e.g. their executed alteration agreement) rather than the whole building.

---

### Phase 5 — Platform and integrations
> Scalability, integrations, and features for managing more than one building.

#### Integrations
- [ ] **Stripe / Plaid payment processing** — Full ACH and card payment rails for maintenance charges, assessments, move fees, and sublet fees. Reconcile payments automatically against charges.
- [ ] **QuickBooks / accounting software export** — The co-op's accountant uses accounting software. Export chart of accounts, journal entries, and vendor payments in a compatible format.
- [ ] **NYC Open Data — HPD violations** — Scheduled pull of open violations by BBL. Auto-create compliance items for new violations and close them when the city marks them corrected.
- [ ] **NYC Open Data — DOB permits** — Import active permits (alteration, construction) filed for the building address. Cross-reference against active alteration applications.
- [ ] **ENERGY STAR Portfolio Manager API** — Pull the building's benchmark score and energy usage data directly rather than requiring manual upload each year.
- [ ] **Intercom / access control (ButterflyMX, Latch, Butterfly)** — Expand beyond the existing ButterflyMX package webhook to full access control events: door opens, visitor check-ins, denied access.

#### Platform
- [ ] **Multi-building support** — A managing agent handles dozens of buildings. Support a single login that switches between buildings, with shared vendor/staff records and consolidated reporting across the portfolio.
- [ ] **Role expansion** — Add a `super` (superintendent) role with access to maintenance, packages, and work orders but not financials or governance. Add a `managing_agent` role with broader access across buildings.
- [ ] **Mobile app (PWA or native)** — The web app is mobile-responsive but a native iOS/Android app enables push notifications, camera access for maintenance photos, and offline package scanning.
- [ ] **Granular notification preferences** — Each resident chooses which events they receive email vs. SMS vs. in-app notifications for. Admins configure building-level defaults.
- [ ] **Data export** — Full CSV/Excel export of any table (residents, charges, maintenance history, audit log) for accountants and attorneys. One-click full data export for data portability.
- [ ] **White-label / custom domain** — Buildings want `portal.250west82.com`, not a generic URL.

#### Security and compliance
- [ ] **Two-factor authentication (TOTP)** — Required for admin/board roles; optional for residents.
- [ ] **SSO / social login** — Google or Microsoft SSO for buildings whose residents are on Google Workspace or Microsoft 365.
- [ ] **SOC 2 readiness** — Log all data access (not just mutations), implement data retention policies, and document the security posture for buildings that require vendor due diligence.
- [ ] **GDPR / CCPA data deletion** — Allow a resident's personal data to be purged on request while retaining the financial and legal records that the building is required to keep.
