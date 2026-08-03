# Preny Clone — SaaS Product

An independent, original SaaS product implementation inspired by the real, observed positioning of `https://preny.ai/` — **not** a copy of preny.ai's actual (inaccessible) backend, database, or business logic. This directory (`saas/`) is separate from the repository's original `capture-rebuild-pipeline` (root-level `capture/`, `analyzer/`, `generator/`, etc.), which remains a distinct, working static-site cloner.

## Product spec derived from observation

Everything below was extracted, verbatim or near-verbatim, from the real capture of `https://preny.ai/` produced by this repo's pipeline (`ai-analysis/output/semantic.json`, `analyzer/output/components.json`, the rendered `rebuild/output/index.html`) — not invented:

- **Positioning** (meta description): "AI chatbot chốt đơn tự động, tăng 50% tỷ lệ mua hàng khi tích hợp vào Fanpage, nhất là chốt sales khi chạy quảng cáo tin nhắn trên Facebook."
- **Real feature descriptions** (hero + body sections, in document order):
  1. "Dữ liệu không chia sẻ - không phụ thuộc nền tảng ngoài" — data ownership.
  2. "Tập trung toàn bộ hội thoại bán hàng từ nhiều kênh vào một giao diện duy nhất" — unified inbox.
  3. "Mọi thông tin khách hàng được tự động ghi nhận và đồng bộ vào mini CRM ngay trong lúc chat" — auto CRM.
  4. "AI Chatbot tư vấn sản phẩm trực quan qua hình ảnh hai chiều — khách gửi ảnh để AI tư vấn, và khách có thể yêu cầu AI gửi lại ảnh sản phẩm" — two-way image consultation.
  5. "Khi nào cần chuyển đổi hội thoại từ Chatbot sang nhân viên hỗ trợ trực tiếp" — documented bot→human handoff.
- **Real nav**: Trang chủ / Hướng dẫn / Tính năng / Bảng giá / Tuyển dụng, plus header "Đăng nhập"/"Đăng ký" buttons — implies real auth and a real pricing page. This repo's capture only recorded the homepage's real content, not the "Hướng dẫn" (guide) or "Tuyển dụng" (careers) subpages' — those two nav items are deliberately omitted here rather than linked to fabricated content. "Trang chủ" and "Bảng giá" (`/bao-gia-dich-vu`, matching the real observed route) are real, working pages; "Tính năng" anchors to the homepage's own real feature sections.
- **Real contact form fields** (5 inputs): full name, username, phone, category — a pre-signup lead/demo-request form.

**Everything not observable from the public marketing page** (database schema, API contracts, internal business logic, the real AI implementation, the real CRM's exact fields) **is this project's own original design** — see `backend/prisma/schema.prisma` for the reasoning behind each model, tied back to the feature bullet above that motivated it.

## Architecture

```
saas/
├── backend/    Node.js + Express + PostgreSQL (Prisma) + Socket.io
│   ├── prisma/schema.prisma   — full data model
│   ├── src/routes/            — REST API, one file per resource (incl. admin.routes.js — platform-admin only)
│   ├── src/services/          — ai.service.js (Claude), facebook.service.js (Graph API),
│   │                              conversation.service.js (shared inbox/bot logic),
│   │                              plan.service.js (subscription/limit enforcement),
│   │                              billing.service.js (real Stripe checkout/portal/webhooks),
│   │                              storage.service.js (local-disk / S3 upload abstraction)
│   ├── src/**/*.test.js       — node --test suite (25 tests) against a real dedicated test DB
│   ├── scripts/dev-db.sh      — local Postgres bootstrap for development
│   ├── scripts/promote-admin.js — CLI-only platform-admin promotion (no self-service path)
│   └── Dockerfile
├── frontend/   React 18 + Vite + React Router
│   ├── src/pages/              — public marketing Home, Login, Register
│   ├── src/pages/dashboard/    — authenticated app (Overview, Inbox, CRM, Chatbots, Products, Fanpages, Orders)
│   ├── src/pages/admin/        — AdminLeads.jsx, platform-operator only
│   ├── public/widget.js        — vanilla-JS embeddable chat widget (no React dependency, for third-party sites)
│   ├── Dockerfile               — Nginx static serve + /api,/uploads,/socket.io reverse proxy
│   └── nginx.conf
└── docker-compose.yml   Postgres + backend + frontend reference topology
```

Auth: JWT access token (in-memory only on the frontend, never localStorage) + httpOnly rotating refresh-token cookie. Realtime: Socket.io, one room per account, used for the live inbox.

## Why these tech choices

- **Node.js + Express**: consistent with the rest of this repository (already Node.js end-to-end); avoids introducing a second language/runtime.
- **PostgreSQL + Prisma**: the domain is fundamentally relational (accounts → users/fanpages/chatbots/customers/conversations/orders, all foreign-keyed); Prisma gives schema-as-code, migrations, and a typed query API.
- **React + Vite**: the dashboard needs real client-side interactivity (live inbox, forms, auth state) that the root pipeline's static-HTML generator was never designed for.
- **Anthropic Claude** for the chatbot: this project runs inside Claude Code: a first-party integration is the most natural, best-supported choice. Swapping providers means only touching `src/services/ai.service.js`.

## Real limitations (not bugs — see code comments at each site)

- **No `ANTHROPIC_API_KEY` is bundled.** Without one, `/api/widget/message` and the Facebook webhook still create real Customer/Conversation/Message rows — the bot-reply step is skipped with a `bot:error` Socket.io event, never a fabricated canned reply. Verified: see `src/services/ai.service.js`'s `generateChatbotReply`.
- **No real Facebook App is configured.** `/api/fanpages/connect/facebook` returns `501` and the webhook signature check returns `403` until real `FACEBOOK_APP_ID`/`FACEBOOK_APP_SECRET`/`FACEBOOK_WEBHOOK_VERIFY_TOKEN` are set — see `.env.example`. The integration code itself (OAuth exchange, Send API calls, HMAC signature verification) is real and complete, not stubbed.
- **Uploaded images default to local disk** (`saas/backend/uploads/`, served at `/uploads/*`) — fine for the dashboard and the Claude vision tool call (images are base64-inlined into the API request, so they never need to be publicly fetchable — see `buildImageSource` in `ai.service.js`), but **not** reachable by real Facebook Messenger servers, which need a publicly reachable URL. Setting `S3_BUCKET`/`AWS_REGION`/`S3_PUBLIC_BASE_URL` (see `.env.example`) switches uploads to real S3 automatically — see `storage.service.js` — with no other code changes; `conversation.service.js` forwards a bot's image reply to Facebook only when the resulting URL isn't a local `/uploads/...` path, so this "just works" once S3 is configured and is silently, correctly skipped otherwise.
- **No real Stripe account is configured.** `/api/billing/checkout` and `/api/billing/portal` return `501` and the `/api/webhooks/stripe` signature check returns `501` until real `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` are set — see `.env.example`. Even with those set, Growth/Business checkout stays disabled per-plan until that plan's real Stripe Price ID is set (`STRIPE_PRICE_ID_GROWTH`/`STRIPE_PRICE_ID_BUSINESS`, read by `prisma/seed.js`) — the dashboard's upgrade buttons disable themselves accordingly (`checkoutAvailable` from `GET /api/dashboard/plans`) rather than starting a checkout for a price that doesn't exist. The integration code itself (Checkout Session creation, Billing Portal, webhook signature verification, subscription status sync) is real and complete, not stubbed — see `billing.service.js`.
- **Deployment config (`Dockerfile`s, `docker-compose.yml`, `nginx.conf`) is written but not build-tested.** This sandbox has no `docker`/`docker-compose` binary (`which docker docker-compose` → not found), so the images have never actually been built or run here. The configs follow standard, well-established Node.js/Nginx/Postgres Docker practice, but treat them as a reviewed starting point, not a verified artifact — run `docker compose up --build` yourself before a real deployment.
- **Known, accepted `npm audit` findings** (see `frontend/package.json`): `esbuild` (dev-server-only, fixing requires a Vite major bump that conflicts with the current `@vitejs/plugin-react` version); a React Router "RSC Mode CSRF" advisory that only applies to React Server Components / framework mode, which this app does not use (plain client-side `BrowserRouter`/`Routes`/`Link` only).

## Running locally

```bash
# 1. Database
cd saas/backend
./scripts/dev-db.sh            # starts local Postgres 16, creates the preny_clone database

# 2. Backend
cp .env.example .env           # fill in ANTHROPIC_API_KEY / FACEBOOK_* / STRIPE_* for real AI/Facebook/billing behavior
npm install
npx prisma migrate dev
npm run seed                   # seeds subscription Plan rows only — no fake accounts/data
npm run dev                    # http://localhost:4000

# 3. Frontend (separate terminal)
cd saas/frontend
npm install
npm run dev                    # http://localhost:5173 — proxies /api, /uploads and /socket.io to :4000

# 4. Tests (backend) — runs against a separate preny_clone_test database,
#    never the dev database, so it's safe to run repeatedly.
cd saas/backend
createdb preny_clone_test      # once, after dev-db.sh has started Postgres
npx prisma migrate deploy      # DATABASE_URL=postgresql://localhost:5432/preny_clone_test
npm test                       # 25 tests, node's built-in test runner

# 5. Promote a real registered user to platform admin (to see /admin/leads)
node scripts/promote-admin.js you@example.com
```

Verified end-to-end on this machine: register → login (JWT + rotating refresh cookie) → create a chatbot → message it through the embeddable widget flow → real Customer/Conversation/Message rows in Postgres → dashboard Inbox shows the thread live; plan-limit `402` enforced live when exceeding the Starter plan's fanpage/chatbot/conversation caps; a real lead submitted through the public form and viewed at `/admin/leads` after promotion; `/api/billing/checkout`, `/api/billing/portal`, and the `/api/webhooks/stripe` signature check all correctly return `501` (curl-verified) with no `STRIPE_SECRET_KEY` set, rather than a fabricated checkout URL. Earlier flows in this list were also screenshotted via a real Chrome instance (Playwright); that browser's cached binary is no longer present in this environment as of the billing work, so the billing UI itself was verified via the API responses above and a clean frontend production build, not a fresh screenshot.

## Production deployment

`Dockerfile`s for both `backend/` and `frontend/`, an `nginx.conf` (static serve + `/api`, `/uploads`, `/socket.io` reverse proxy — mirrors `vite.config.js`'s dev proxy rules), and a root `docker-compose.yml` (Postgres + backend + frontend, persistent volumes for `pgdata` and `uploads`) are provided. **These have not been build-tested in this environment** — no `docker` binary is available in this sandbox — so review them yourself and run `docker compose up --build` before a real deployment; see "Real limitations" above.

## What's next (real, not deferred as "won't do")

- Actually build/run/test the Docker images and compose stack against a Docker-capable environment (this sandbox can't).
- Actually run a real Stripe Checkout/webhook round-trip against a live (or `stripe-mock`/test-mode) Stripe account — this sandbox has no Stripe credentials, so `billing.service.js` is verified up to the "not configured" boundary (real 501s, tested) but the actual payment flow has never executed.
- Broader test coverage: the current 25 tests cover auth, plan enforcement, the admin/platform-admin boundary, and billing's not-configured paths; the AI tool-use loop, Facebook webhook signature/OAuth paths, the realtime Socket.io inbox, and a real Stripe webhook payload are still verified manually (or not at all) rather than by automated test — each requires either a real third-party credential or heavier mocking than this project has taken on.
