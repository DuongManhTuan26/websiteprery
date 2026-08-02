# Architecture — Preny-equivalent SaaS platform

This is a **new, independently designed** product. It is inspired by the
feature surface publicly visible on `https://preny.ai/` (AI chatbot widget,
mini CRM, multi-channel-style conversation inbox, workspace/team model) but
none of its backend, database schema, API contracts, or business logic are
copied or reverse-engineered from the real Preny product — that system was
never observed (it lives behind authentication at `app.preny.ai`, which this
project has no access to). Every piece of this system is designed from
scratch using standard, well-documented SaaS patterns.

This directory (`saas/`) is fully independent from the sibling
`capture-rebuild-pipeline` at the repo root (`capture/`, `normalize/`,
`analyzer/`, ..., `rebuild/output/`) — that pipeline's job is producing a
faithful **static clone of the public marketing page**; this directory's job
is a **new, runnable product** with its own backend, database, and UI. They
do not share code, dependencies, or build output.

## Goals / non-goals

- Goal: a chatbot-widget SaaS a small team could actually run — register,
  create a workspace, configure a chatbot, embed a widget on any page, have
  it reply via a pluggable AI provider, see the conversation and a contact
  record in a dashboard.
- Goal: production-viable patterns (migrations, hashed passwords, short-lived
  JWTs + rotating refresh tokens, tenant isolation enforced at the query
  layer, Docker deployment) — not a toy.
- Non-goal: feature-parity with a mature commercial product (billing,
  multi-channel connectors to Zalo/Facebook/TikTok, campaign/remarketing
  automation, a real trained AI model). Those require either payment
  processor integration, third-party platform API partnerships, or an actual
  ML training pipeline — out of scope for what a single new codebase can
  responsibly claim to provide. The **AI provider layer is an extension
  point** for those (a real interface, not a promise that a specific
  provider is wired up) — plugging in a real LLM provider is a config
  change, not a rewrite.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Backend runtime | Node.js 22 + TypeScript | Matches the rest of this repo's toolchain; no context-switch for whoever maintains both. |
| HTTP framework | Express 4 | Minimal, extremely well understood, easy to audit — this system doesn't need a heavier framework's opinions. |
| Database | PostgreSQL 16 | Relational integrity for tenant/user/billing-adjacent data, JSON columns where flexibility is genuinely needed (e.g. contact custom fields later). |
| ORM / migrations | Prisma | Schema-as-code, generated migrations checked into git, type-safe client — avoids hand-written SQL drift between environments. |
| Auth | JWT access token (short-lived, 15 min) + rotating refresh token (stored hashed in DB, 30 days) | Stateless API auth without keeping sessions in memory, while refresh tokens remain revocable (DB-backed) unlike a pure-stateless refresh JWT. |
| Password hashing | bcrypt | Industry-standard, no reason to roll anything custom. |
| Frontend (dashboard) | React 18 + Vite + TypeScript | Fast dev loop, same ecosystem as the widget bundle. |
| Embeddable widget | Vanilla TypeScript, no framework, built to a single IIFE bundle | A widget embedded on a third-party page must not bring a framework runtime or fight the host page's own React/Vue — keep it dependency-free and tiny. |
| AI provider | Interface-based abstraction; `MockAIProvider` (deterministic, no network) as the default, `OpenAIProvider` as a real, optional implementation | Runnable and testable with zero external dependencies out of the box; a real provider is a config flag away, not fabricated demo output pretending to be a trained model. |
| Deployment | Docker + docker-compose (postgres, api, web) | Reproducible, matches "production-ready" requirement without assuming a specific cloud provider. |

## Multi-tenancy model

- `User` — a person, can belong to multiple `Workspace`s.
- `Workspace` — the tenant boundary. Every tenant-owned row (`Chatbot`,
  `Contact`, `Conversation`, `ApiKey`, ...) carries a `workspaceId` foreign
  key, and **every** query in `src/modules/*` is required to filter by the
  caller's workspace membership — enforced by a shared `requireWorkspaceMember`
  middleware that resolves `req.workspaceId` from the URL and checks a
  `WorkspaceMember` row exists before any handler runs. There is no
  cross-tenant query path in the codebase; a missing membership row is a 403,
  not a silently-empty result set.
- `WorkspaceMember.role` — `OWNER` / `ADMIN` / `MEMBER`, checked per-route via
  a `requireRole()` middleware for destructive/admin actions (deleting a
  workspace, managing API keys, inviting/removing members).

## Module layout (backend)

```
backend/src/
  app.ts                 — express app factory (used by both the server and tests)
  index.ts               — process entrypoint (listens on PORT)
  config/                — env loading + validation (fails fast on missing required vars)
  db/                     — Prisma client singleton
  middleware/             — auth (JWT verify), requireWorkspaceMember, requireRole, error handler
  modules/
    auth/                 — register, login, refresh, logout
    workspaces/           — CRUD, membership
    chatbots/              — CRUD, widget token issuance
    ai-providers/           — AIProvider interface + Mock/OpenAI implementations + selection logic
    widget/                — public (unauthenticated, token-scoped) endpoints the embedded widget calls
    conversations/          — conversation/message read APIs for the dashboard
    crm/                    — Contact CRUD
    settings/               — workspace profile, API key management
  utils/
prisma/
  schema.prisma
  migrations/               — one directory per `prisma migrate dev`, checked in
tests/                       — vitest, run against the real `saas_test` Postgres database
```

Each `modules/<name>/` directory is self-contained: `router.ts` (routes),
`service.ts` (business logic + Prisma calls), `*.test.ts` (integration
tests hitting a real test database, not mocks — consistent with this repo's
existing "verify against real execution, not assumptions" convention).

## Data model (grows incrementally per phase — see migrations)

Final shape after all phases:

```
User (id, email, passwordHash, name)
RefreshToken (id, userId, tokenHash, expiresAt, revokedAt)
Workspace (id, name, slug)
WorkspaceMember (id, workspaceId, userId, role)
Chatbot (id, workspaceId, name, systemPrompt, aiProvider, aiModel, widgetToken, isActive)
Conversation (id, chatbotId, contactId, channel)
Message (id, conversationId, role, content, createdAt)
Contact (id, workspaceId, name, email, phone, notes, tags[])
ApiKey (id, workspaceId, provider, encryptedKey)
```

Each entity is introduced in the migration for the phase that needs it
(auth → `User`/`RefreshToken`; workspace → `Workspace`/`WorkspaceMember`;
chatbot → `Chatbot`; conversation storage → `Conversation`/`Message`; CRM →
`Contact`; settings → `ApiKey`) rather than all at once, so every commit's
migration is small and reviewable.

## Security notes

- Passwords: bcrypt, cost factor 12.
- Refresh tokens: stored as a SHA-256 hash (not plaintext) in `RefreshToken`,
  rotated on every use (old one revoked, new one issued) — limits the blast
  radius of a leaked token.
- API keys for AI providers (`ApiKey.encryptedKey`): encrypted at rest with
  AES-256-GCM using a server-held key from `ENCRYPTION_KEY` env var, never
  returned to the client after creation (write-only from the API's
  perspective).
- Widget endpoints are public by design (a website visitor has no account)
  but scoped by an unguessable per-chatbot `widgetToken` (UUID) — never by
  workspace/session auth. A widget token can only read/write conversations
  for its own chatbot.
- CORS: dashboard API requires an authenticated session from the configured
  frontend origin; widget API allows any origin (it's meant to be embedded
  on arbitrary third-party sites), but only exposes the narrow widget
  surface, never the authenticated dashboard routes.

## What "production-ready" means here, concretely

- Environment-driven config (`.env`, validated at boot, fails fast rather
  than running with silently-wrong defaults in production).
- Migrations are the only way the schema changes (no `db push`/manual DDL).
- Structured error handling: a single Express error middleware maps known
  error types (validation, auth, not-found, forbidden) to correct HTTP
  status codes; unknown errors are logged and return a generic 500 (no stack
  traces leaked to clients).
- Health endpoint (`GET /health`) that checks DB connectivity, for use by
  container orchestration.
- Dockerized with multi-stage builds (small production images, no dev
  dependencies shipped).

## Verification approach per phase

Every phase in this build is committed only after, on this machine:
1. `npm run build` (backend and/or frontend as applicable) succeeds.
2. Any new Prisma migration is actually applied to a real local PostgreSQL
   16 instance (`saas_dev`) — verified via `prisma migrate status` /
   inspecting the resulting schema, not just "the migration file was
   written."
3. `npm test` (vitest) passes against a real `saas_test` PostgreSQL
   database — no mocked DB layer.
4. For phases with a UI, the relevant page is loaded and the API round-trip
   exercised (documented in that phase's commit message).

Docker/production deployment (final phase) is verified by static
correctness of the Dockerfiles/compose file plus `docker build` where the
sandbox allows it; the Docker **daemon** is not running in this development
sandbox (`docker ps` fails to reach `/var/run/docker.sock`), which is
disclosed rather than silently assumed working — see that phase's commit
message for exactly what was and wasn't exercised.
