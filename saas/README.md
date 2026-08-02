# saas/ — chatbot SaaS platform

A new, independently designed product (not a reverse-engineering of any
existing site's backend — see `ARCHITECTURE.md`'s opening section for why).
Register a workspace, create a chatbot, embed it on any page with one
script tag, and see the resulting conversations and contacts in a
dashboard.

## Documentation map

- **`ARCHITECTURE.md`** — system design, stack choices and why, data model,
  security notes, and a running "known rough edges" list of real issues
  found and fixed during development.
- **`DEPLOYMENT.md`** — Docker/docker-compose setup, and a precise account
  of what was and wasn't verified in this sandbox and why.
- **`backend/README.md`**, **`frontend/README.md`**, **`widget/README.md`**
  — per-package setup and API/component reference.

## Local development (without Docker)

Three packages, run independently:

```bash
# 1. Database (see backend/README.md for the one-time CREATE USER/DATABASE step)
# 2. Backend
cd backend && npm install && cp .env.example .env && npm run build && npm start
# 3. Frontend (separate terminal)
cd frontend && npm install && cp .env.example .env && npm run dev
# 4. Widget (only needed if working on the widget itself — the backend
#    serves the already-built dist/widget.js at GET /widget.js)
cd widget && npm install && npm run build
```

## Local development (Docker)

See `DEPLOYMENT.md` — `docker compose up --build` from this directory.

## Status

All 13 planned phases are implemented (architecture → backend init →
database → auth → dashboard shell → workspace/tenant → chatbot CRUD → AI
provider abstraction → embeddable widget → conversation storage → mini CRM
→ settings → deployment), each committed separately with its own
migration/API/UI/tests where applicable — see git log for this directory
for the phase-by-phase history and what was verified at each step.
