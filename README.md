# Apty

## Mission

Empower people to improve their homes and communities

## Vision

A home is more than a house. A community is more than a set of buildings.

Apty provides a platform for people and APIs to plug in, both by providing data and services.  For users, we use this data to power user experiences that improve their lives and their communities. Apty provides a basic set of services necessary to empower a single home, a building, or a set of buildings to be able to share information, when and as needed. 

## Components

## Plugins

### Data plugins

### Service plugins

### UI plugins

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- (Optional) [Docker](https://www.docker.com/) and Docker Compose for the full MySQL stack

### Local Development (SQLite — quickest)

No database setup required. The app auto-detects when `MYSQL_HOST` is not set and uses a local SQLite database.

```bash
# Install dependencies
npm install

# Seed the database with sample data (24 units at 250 W 82nd St)
npm run seed

# Start the dev server (with auto-reload)
npm run dev

# Or start without auto-reload
npm start
```

The app will be available at **http://localhost:3000**.

**Default admin login:** `admin@250w82.com` / `admin123`

### Docker Compose (MySQL)

If you prefer the full MySQL-backed setup:

```bash
docker compose up -d
```

This starts both the Node app and a MySQL 5.7 container. The app listens on port 3000.

To seed the Docker database:

```bash
docker compose exec app node src/persistence/seed.js
```

### Running Tests

```bash
npm test
```

## API Endpoints

All API routes are under `/api/`:

| Resource | Endpoint |
|---|---|
| Building info | `GET /api/building` |
| Units | `GET /api/units` |
| Residents | `GET /api/residents` |
| Board members | `GET /api/board` |
| Announcements | `GET /api/announcements` |
| Documents | `GET /api/documents` |
| Maintenance requests | `GET /api/maintenance` |
| Finances | `GET /api/finances` |
| Staff | `GET /api/staff` |
| Vendors | `GET /api/vendors` |
| Applications | `GET /api/applications` |
| Waitlists | `GET /api/waitlists` |
| Compliance | `GET /api/compliance` |
| Auth | `POST /api/auth/login` |

## Engineering Stack

- **Runtime:** Node.js + Express
- **Database:** MySQL (production) or SQLite (local dev)
- **Containerization:** Docker / Docker Compose
- **Testing:** Jest

## Design Notes

Structure as a web app + database

Diagram : https://viewer.diagrams.net/?highlight=0000ff&edit=_blank&layers=1&nav=1&title=data_arch.dataio#Uhttps%3A%2F%2Fraw.githubusercontent.com%2Fmathewar%2Fapty%2Fmain%2Fdata_arch.dataio
TODO : Figure out how to embed this directly.

## Contributions

Very welcome - just getting started here. Need help from anyone who's set up an open source webapp before.
