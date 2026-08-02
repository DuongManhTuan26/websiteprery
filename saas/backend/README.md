# saas-backend

Express + TypeScript API. See `../ARCHITECTURE.md` for the full system design.

## Setup

```bash
npm install
cp .env.example .env   # then fill in real values
npm run build
npm start               # or: npm run dev (watch mode)
```

## Tests

Tests run against a real PostgreSQL database (`.env.test`, `saas_test`), not
mocks — create it once locally:

```sql
CREATE USER saas_app WITH PASSWORD 'saas_dev_password';
CREATE DATABASE saas_dev OWNER saas_app;
CREATE DATABASE saas_test OWNER saas_app;
```

```bash
npm test
```

## Database

PostgreSQL via [Prisma 7](https://www.prisma.io/) (driver-adapter based —
`@prisma/adapter-pg`, required by Prisma 7's client). Schema lives in
`prisma/schema.prisma`; every change is a checked-in migration under
`prisma/migrations/`, never a manual `db push` against a real environment.

```bash
npm run prisma:migrate    # create + apply a migration locally (saas_dev)
npm run prisma:deploy     # apply existing migrations without prompting (CI/prod)
```

Tests apply the same migrations to the separate `saas_test` database — see
"Tests" above.

## Auth

- `POST /auth/register` `{email, password, name}` -> `201 {user, tokens}`
- `POST /auth/login` `{email, password}` -> `200 {user, tokens}`
- `POST /auth/refresh` `{refreshToken}` -> `200 {accessToken, refreshToken}` (rotates; the presented token is revoked)
- `POST /auth/logout` `{refreshToken}` -> `204`
- `GET /auth/me` (`Authorization: Bearer <accessToken>`) -> `200 {user}`

Access tokens are JWTs (15m default, `ACCESS_TOKEN_TTL`). Refresh tokens are
opaque random strings; only their SHA-256 hash is stored, and every refresh
rotates the token (old one revoked) so reuse of a stolen-then-rotated token
is rejected rather than silently accepted. `requireAuth` middleware
(`src/middleware/requireAuth.ts`) protects any route that needs a logged-in
user; workspace-scoped role checks (`requireRole`) land in the workspace
phase, built on top of this.

## Health check

`GET /health` — checks DB connectivity via `SELECT 1`; returns `503` with
`{"status":"degraded","db":"unreachable"}` if the database can't be reached,
`200` with `{"status":"ok","db":"ok"}` otherwise. Used by container
orchestration.
