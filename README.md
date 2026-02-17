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

## API

All routes under `/api/`:

| Resource | Base path |
|---|---|
| Building | `/api/building` |
| Units | `/api/units` |
| Residents | `/api/residents` |
| Board | `/api/board` |
| Announcements | `/api/announcements` |
| Documents | `/api/documents` |
| Maintenance | `/api/maintenance` |
| Finances | `/api/finances` |
| Staff | `/api/staff` |
| Vendors | `/api/vendors` |
| Applications | `/api/applications` |
| Waitlists | `/api/waitlists` |
| Compliance | `/api/compliance` |
| Auth | `/api/auth` |
| Packages | `/api/packages` |
| Service providers | `/api/providers` |
| ButterflyMX webhook | `/api/integrations/butterflymx` |

### Packages

`GET /api/packages?unit_id=&status=&source=` — list (filter by unit, status, source)
`POST /api/packages` — log a package manually
`PUT /api/packages/:id` — update (e.g. `{ status: 'picked_up', picked_up_at: ... }`)
`DELETE /api/packages/:id`

Statuses: `arrived` → `notified` → `picked_up`

### Service provider plugin API

External systems register as providers and push normalized events:

```
POST /api/providers              — register (returns one-time api_key)
POST /api/providers/events       — push event (X-Provider-Key header)
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

`POST /api/integrations/butterflymx/webhook` — validates HMAC-SHA256 signature (`X-ButterflyMX-Signature`), maps payload to package record, deduplicates by `event_id`. Configure `webhook_secret` in the provider's config JSON.

## Stack

- Node.js + Express
- SQLite (dev) / MySQL (prod)
- React + React-Bootstrap (single-page frontend)
- Docker Compose

## Contributions

Very welcome — just getting started here.
