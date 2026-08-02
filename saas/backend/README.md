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

## AI providers

`src/modules/ai-providers/` — the `AIProvider` interface (`generateReply`)
that everything else (chatbots, the widget, conversation storage) depends
on, not on a concrete implementation:

- `MockAIProvider` (default, `aiProvider: 'MOCK'`) — deterministic, offline,
  no credentials needed. Replies are explicitly prefixed `[mock-ai]` so
  nobody mistakes them for a real model's output.
- `OpenAIProvider` (`aiProvider: 'OPENAI'`) — real integration against the
  Chat Completions API via `fetch` (no SDK dependency). Requires a workspace
  API key (wired up in the settings phase); `getProvider('OPENAI')` without
  a key throws a clear `ValidationError` rather than silently using Mock.
  **Not verified against the real OpenAI API** — `api.openai.com` isn't
  reachable from this sandbox's egress allowlist, so this is covered by
  tests against a mocked `fetch` only; see the class's header comment.

`POST /workspaces/:workspaceId/chatbots/:chatbotId/test-reply` `{message}`
-> `200 {reply}` exercises a chatbot's configured provider directly (any
workspace member) — useful for confirming configuration before conversation
storage (a later phase) or the embeddable widget are wired up to the same
call.

## Widget (public API)

No authentication — access is scoped by the unguessable per-chatbot
`widgetToken` in the URL, not by workspace/session. Mounted with permissive
CORS (`origin: true`) since a real embed is loaded from arbitrary
third-party origins.

- `GET /widget/:widgetToken/config` -> `200 {name, isActive}`
- `POST /widget/:widgetToken/message` `{message, conversationId?}` -> `200
  {reply, conversationId}` — omit `conversationId` to start a new,
  server-persisted conversation; pass the returned id on every subsequent
  message in the same session. History sent to the AI provider is always
  loaded from real storage (`Message` rows), never trusted from the client
  — this replaced an earlier client-supplied `history` array design from
  when the widget phase shipped without persistence.
- `GET /widget.js` — serves the built widget bundle
  (`../widget/dist/widget.js`) with `Cross-Origin-Resource-Policy:
  cross-origin` explicitly set, overriding helmet's default `same-origin`
  policy for this one route so a third-party page's `<script src=...>` can
  actually execute it.

## Conversations (dashboard, read-only)

Nested under a workspace, any member:

- `GET /workspaces/:workspaceId/conversations` -> `200 {conversations}` —
  every conversation across every chatbot in the workspace, most recently
  updated first, with a message count and last-message preview.
- `GET /workspaces/:workspaceId/conversations/:conversationId` -> `200
  {conversation}` — full message thread, oldest first.

Both are populated entirely by the public widget API (`POST
/widget/:widgetToken/message`) — there's no separate "create conversation"
endpoint on the dashboard side. Every query filters by `chatbot:
{workspaceId}` (not just the conversation id), so a conversation id from a
different tenant 404s even for an authenticated member of some other
workspace.

## Mini CRM (contacts)

Nested under a workspace:

- `POST /workspaces/:workspaceId/contacts` `{name?, email?, phone?, notes?, tags?}` -> `201 {contact}` (any member)
- `GET /workspaces/:workspaceId/contacts` -> `200 {contacts}` (any member)
- `GET /workspaces/:workspaceId/contacts/:contactId` -> `200 {contact}` (any member) — includes linked conversations, each with a real last-message preview and message count (same shape as the conversations list endpoint)
- `PATCH /workspaces/:workspaceId/contacts/:contactId` -> `200 {contact}` (any member)
- `DELETE /workspaces/:workspaceId/contacts/:contactId` -> `204` (`OWNER`/`ADMIN` only)

Deliberately minimal fields — no custom fields, no pipeline/stage — rather
than guessing what a full CRM should look like without a real product spec.

Linking a conversation to a contact is a conversations-module endpoint:
`PATCH /workspaces/:workspaceId/conversations/:conversationId/contact
{contactId}` (`contactId: null` to unlink). Both the conversation and the
contact are independently verified to belong to `:workspaceId` — a
`contactId` from a different tenant 404s rather than silently linking
across tenants.

## Settings (API keys)

Nested under a workspace:

- `GET /workspaces/:workspaceId/settings/api-keys` -> `200 {apiKeys}` (any
  member) — `[{provider, configured, updatedAt}]`, **never** the key itself.
- `PUT /workspaces/:workspaceId/settings/api-keys/:provider` `{apiKey}` ->
  `200 {apiKey}` (`OWNER`/`ADMIN` only — a workspace-wide credential, same
  restriction tier as deleting a chatbot) — upserts, encrypted at rest
  (AES-256-GCM, `src/utils/encryption.ts`), response never echoes the value
  back.
- `DELETE /workspaces/:workspaceId/settings/api-keys/:provider` -> `204`
  (`OWNER`/`ADMIN` only).

Only `OPENAI` is a settable provider (`MOCK` needs no key and is rejected
with 400 if attempted). This closes a TODO left open since the AI-provider-
abstraction phase: `chatbots/service.ts`'s `testChatbotReply` and
`widget/service.ts`'s `sendMessage` now call
`settings/service.ts`'s `getDecryptedApiKey()` before building a provider,
so a chatbot configured for `OPENAI` with a real key set here will actually
call the real OpenAI API (verified with a mocked `fetch` — see
`tests/settings.test.ts`'s "end-to-end wiring" test, which asserts the
exact decrypted key reaches the `Authorization` header).

## Health check

`GET /health` — checks DB connectivity via `SELECT 1`; returns `503` with
`{"status":"degraded","db":"unreachable"}` if the database can't be reached,
`200` with `{"status":"ok","db":"ok"}` otherwise. Used by container
orchestration.
