# saas-frontend

React + Vite + TypeScript dashboard. See `../ARCHITECTURE.md` for the system
design.

## Setup

```bash
npm install
cp .env.example .env   # VITE_API_URL, defaults to http://localhost:4000
npm run dev             # http://localhost:5173
```

Requires `saas-backend` running (see `../backend/README.md`).

## Structure

- `src/lib/api.ts` — fetch wrapper: attaches the bearer access token,
  transparently refreshes-and-retries once on a 401, stores tokens in
  `localStorage`.
- `src/context/AuthContext.tsx` — current user + login/register/logout,
  resolved on mount via `GET /auth/me` if a token is already stored (so a
  page reload keeps the session).
- `src/components/ProtectedRoute.tsx` — redirects to `/login` if there's no
  authenticated user.
- `src/components/DashboardLayout.tsx` — sidebar shell shared by every
  authenticated page; nav items beyond "Overview" are wired up as their
  phases land (Chatbots, Conversations, Contacts, Settings).
- `src/pages/` — Login, Register, Dashboard (overview).
- `src/context/WorkspaceContext.tsx` — loads the user's workspaces, tracks
  the selected one (persisted in `localStorage`), exposes `createWorkspace`.
- `src/components/CreateWorkspacePrompt.tsx` — shown instead of the
  dashboard when the user has zero workspaces (every account needs at least
  one tenant before anything else makes sense to show).
- `src/components/WorkspaceSwitcher.tsx` — sidebar dropdown + inline
  "create new workspace" form.
- `src/pages/Chatbots.tsx` — CRUD for the current workspace's chatbots
  (`/dashboard/chatbots`), plus per-chatbot "Test" (calls
  `/test-reply` inline) and "Embed" (shows the real `<script>` snippet,
  with the actual widget token filled in, to copy onto any page).
- `src/pages/Conversations.tsx` — master-detail view of every real
  conversation the widget has recorded (`/dashboard/conversations`):
  a list (chatbot name, linked contact if any, last-message preview,
  updated time) and, on selection, the full message thread plus a
  dropdown to link/unlink a contact. Linking triggers both the detail
  reload and a background refresh of the summary list (a real bug from
  this phase's own E2E testing: linking updated the detail pane but left
  the list showing stale data until a full page reload).
- `src/pages/Contacts.tsx` — mini CRM (`/dashboard/crm`): create/list/
  delete contacts, and per-contact a notes editor + read-only list of
  linked conversations.
- `src/pages/Settings.tsx` — workspace rename, member management (invite by
  email, change role, remove — the UI for endpoints that have existed since
  the workspace phase but never had a frontend), and AI provider API key
  management (masked input, "Configured"/"Not configured" status, never
  shows a saved key's value again).

Routing is now nested (`DashboardLayout` renders `<Outlet/>`) so new
authenticated pages are added as child routes in `App.tsx` rather than each
page re-implementing the shell.

## Tests

```bash
npm test
```

Component-level tests (Vitest + Testing Library) mock `src/lib/api.ts` and
exercise real component behavior (form submission, error display, redirect
logic) — fast, no backend required. The full authenticated flow (register
through the real UI → real backend → dashboard renders the real user →
reload persists the session → logout) is additionally verified with a real
headless-Chromium run against both dev servers each phase; see the phase's
commit message for that run's output.
