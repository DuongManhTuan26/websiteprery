# saas-widget

The embeddable chat widget. Builds to a single, dependency-free IIFE bundle
(`dist/widget.js`, ~5.5kB / ~2kB gzipped) — no framework runtime, so it
never collides with whatever the host page itself uses.

## Build

```bash
npm install
npm run build   # -> dist/widget.js
```

The backend serves this file directly at `GET /widget.js` (see
`../backend/src/app.ts`) with `Cross-Origin-Resource-Policy: cross-origin`
set explicitly — helmet's default policy would otherwise silently block a
third-party page from executing a script loaded from this origin.

## Embedding

```html
<script src="https://your-api-host/widget.js" data-token="<chatbot widget token>" data-api-url="https://your-api-host"></script>
```

The dashboard's Chatbots page has a "Embed" button per chatbot that
generates this exact snippet with the real token filled in.

## Architecture

- `src/api.ts` — talks to the backend's public `/widget/:token/*` routes
  (see `../backend/README.md` "AI providers" / widget sections). No
  authentication — access is scoped entirely by the unguessable
  `widgetToken` in the URL.
- `src/widget.ts` — reads `data-token`/`data-api-url` off its own
  `<script>` tag (`document.currentScript`), renders a floating bubble +
  chat panel into a **Shadow DOM** host (so the widget's styles can never
  leak into, or be broken by, the host page's own CSS). Conversation
  history is owned by the server: the first message omits `conversationId`,
  the backend creates a real `Conversation` and returns its id, and the
  widget passes that id on every subsequent message so the AI always sees
  history loaded from real storage — the client no longer sends its own
  history array (an earlier, pre-persistence design).

## Manual cross-origin test fixture

`example/host-page.html` is a minimal stand-in for "a customer's own
website" — replace `__TOKEN__` with a real chatbot's widget token, serve it
from any static server on a **different port** than the backend, and open
it in a browser to confirm the widget actually works when embedded
cross-origin (not just same-origin, which would hide CORS/CORP bugs).

## Tests

```bash
npm test
```

Unit tests (Vitest + jsdom) cover `WidgetApi`'s request/response handling
against a mocked `fetch`. The full real-world scenario — build the bundle,
serve it from the real backend, embed it on a page served from a
**completely different origin**, open the widget, send a real message, get
a real reply — was verified with a live headless-Chromium run each time
this module changed; see the relevant commit message for that run's output
(it's what caught the Cross-Origin-Resource-Policy issue during
development, before this file existed to document it).
