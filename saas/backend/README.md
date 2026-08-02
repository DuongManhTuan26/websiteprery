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

## Workspaces (tenants)

All routes require `Authorization: Bearer <accessToken>`.

- `POST /workspaces` `{name}` -> `201 {workspace}` — creator becomes `OWNER`
- `GET /workspaces` -> `200 {workspaces}` — every workspace the caller belongs to, with their role
- `GET /workspaces/:workspaceId` -> `200 {workspace}` (any member)
- `PATCH /workspaces/:workspaceId` `{name}` -> `200 {workspace}` (`OWNER`/`ADMIN`)
- `DELETE /workspaces/:workspaceId` -> `204` (`OWNER` only)
- `GET /workspaces/:workspaceId/members` -> `200 {members}` (any member)
- `POST /workspaces/:workspaceId/members` `{email, role?}` -> `201 {member}` (`OWNER`/`ADMIN`) — adds an *existing* registered user by email; there's no invite-email flow yet, so the person must already have an account
- `PATCH /workspaces/:workspaceId/members/:userId` `{role}` -> `200 {member}` (`OWNER`/`ADMIN`, see RBAC below)
- `DELETE /workspaces/:workspaceId/members/:userId` -> `204` (`OWNER`/`ADMIN`, see RBAC below)

Every `:workspaceId` route is guarded by `requireWorkspaceMember` — a 403 if
the caller has no membership row, never a filtered/empty result. Role
enforcement is two-layered: route-level `requireRole()` gates who can even
attempt an action, and the service layer additionally checks the *target's*
role for member mutations:
- `ADMIN` can remove/change the role of a plain `MEMBER`, never another
  `ADMIN` or an `OWNER`.
- Only `OWNER` can grant `OWNER`, and the last remaining `OWNER` of a
  workspace can never be removed or demoted (would leave the tenant
  ownerless).

## Chatbots

Nested under a workspace (`Authorization: Bearer <accessToken>`, caller must
be a member of `:workspaceId`):

- `POST /workspaces/:workspaceId/chatbots` `{name, systemPrompt?, aiProvider?, aiModel?}` -> `201 {chatbot}` (any member)
- `GET /workspaces/:workspaceId/chatbots` -> `200 {chatbots}` (any member)
- `GET /workspaces/:workspaceId/chatbots/:chatbotId` -> `200 {chatbot}` (any member)
- `PATCH /workspaces/:workspaceId/chatbots/:chatbotId` -> `200 {chatbot}` (any member)
- `DELETE /workspaces/:workspaceId/chatbots/:chatbotId` -> `204` (`OWNER`/`ADMIN` only)

Every chatbot lookup is scoped by *both* `id` and `workspaceId`
(`findFirst({where: {id, workspaceId}})`) — knowing another workspace's
chatbot id is not enough to read or mutate it even though `:workspaceId`
membership is already separately enforced; this is the same tenant-isolation
discipline as every other module.

A chatbot gets a random `widgetToken` (UUID) at creation — this is what the
embeddable widget (a later phase) uses to authenticate publicly, scoped to
that one chatbot only, never to the workspace or a user session.

## Health check

`GET /health` — checks DB connectivity via `SELECT 1`; returns `503` with
`{"status":"degraded","db":"unreachable"}` if the database can't be reached,
`200` with `{"status":"ok","db":"ok"}` otherwise. Used by container
orchestration.
