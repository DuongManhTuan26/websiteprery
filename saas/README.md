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
- **Real nav**: Trang chủ / Hướng dẫn / Tính năng / Bảng giá / Tuyển dụng, plus header "Đăng nhập"/"Đăng ký" buttons — implies real auth and a real pricing page.
- **Real contact form fields** (5 inputs): full name, username, phone, category — a pre-signup lead/demo-request form.

**Everything not observable from the public marketing page** (database schema, API contracts, internal business logic, the real AI implementation, the real CRM's exact fields) **is this project's own original design** — see `backend/prisma/schema.prisma` for the reasoning behind each model, tied back to the feature bullet above that motivated it.

## Architecture

```
saas/
├── backend/    Node.js + Express + PostgreSQL (Prisma) + Socket.io
│   ├── prisma/schema.prisma   — full data model
│   ├── src/routes/            — REST API, one file per resource
│   ├── src/services/          — ai.service.js (Claude), facebook.service.js (Graph API),
│   │                              conversation.service.js (shared inbox/bot logic)
│   └── scripts/dev-db.sh      — local Postgres bootstrap for development
└── frontend/   React 18 + Vite + React Router
    ├── src/pages/              — public marketing Home, Login, Register
    ├── src/pages/dashboard/    — authenticated app (Overview, Inbox, CRM, Chatbots, Products, Fanpages, Orders)
    └── public/widget.js        — vanilla-JS embeddable chat widget (no React dependency, for third-party sites)
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
- **Uploaded images are local-disk only** (`saas/backend/uploads/`, served at `/uploads/*`). This works end-to-end for the dashboard and the Claude vision tool call (images are base64-inlined into the API request, so they never need to be publicly fetchable — see `buildImageSource` in `ai.service.js`). It does **not** work for sending a product image back through real Facebook Messenger, since Facebook's servers need a publicly reachable URL — `conversation.service.js` deliberately skips that specific send rather than pass Facebook an unreachable `localhost` path. Production deployments need real object storage (S3/Cloudinary/etc.) for that path to work.
- **Lead visibility has no UI.** `POST /api/leads` (the public "Dùng thử miễn phí" form) is intentionally unauthenticated — a Lead belongs to the platform operator, not to any tenant Account, and this repo has no platform-admin role/UI yet. Leads are captured, not yet browsable.
- **Known, accepted `npm audit` findings** (see `frontend/package.json`): `esbuild` (dev-server-only, fixing requires a Vite major bump that conflicts with the current `@vitejs/plugin-react` version); a React Router "RSC Mode CSRF" advisory that only applies to React Server Components / framework mode, which this app does not use (plain client-side `BrowserRouter`/`Routes`/`Link` only).

## Running locally

```bash
# 1. Database
cd saas/backend
./scripts/dev-db.sh            # starts local Postgres 16, creates the preny_clone database

# 2. Backend
cp .env.example .env           # fill in ANTHROPIC_API_KEY / FACEBOOK_* for real AI/Facebook behavior
npm install
npx prisma migrate dev
npm run seed                   # seeds subscription Plan rows only — no fake accounts/data
npm run dev                    # http://localhost:4000

# 3. Frontend (separate terminal)
cd saas/frontend
npm install
npm run dev                    # http://localhost:5173 — proxies /api and /uploads to :4000
```

Verified end-to-end on this machine: register → login (JWT + rotating refresh cookie) → create a chatbot → message it through the embeddable widget flow → real Customer/Conversation/Message rows in Postgres → dashboard Inbox shows the thread live. Screenshotted via a real Chrome instance (Playwright), not just curl.

## What's next (real, not deferred as "won't do")

- Stripe (or equivalent) billing wired to the `Subscription`/`Plan` models — currently seeded but not enforced anywhere (no plan-limit checks on fanpages/chatbots/conversations yet).
- Platform-admin role + UI for browsing captured `Lead` rows.
- Object storage (S3-compatible) for uploads, so Facebook image replies work in production.
- Automated tests (none exist yet — verification so far is manual, end-to-end, against the real running stack).
- Production deployment config (Dockerfile / process manager / managed Postgres connection string) — currently dev-only (`scripts/dev-db.sh` explicitly is not a production setup).
