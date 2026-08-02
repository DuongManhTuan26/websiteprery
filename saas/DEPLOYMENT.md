# Deployment

## Quick start (Docker Compose)

```bash
cd saas/
cp .env.example .env    # then fill in real secrets — see comments in the file
docker compose up --build
```

- Dashboard: http://localhost:8080
- API: http://localhost:4000
- Postgres: localhost:5432 (exposed for local debugging; remove the port
  mapping in `docker-compose.yml` for a real production deployment — a
  database shouldn't be reachable from outside the compose network)

Migrations run automatically on backend container start
(`prisma migrate deploy`, see `backend/Dockerfile`'s `CMD`).

## Architecture

Three images, one Postgres:

- `backend/Dockerfile` — multi-stage: builds `saas/widget` (so the backend
  can serve `GET /widget.js` directly, no separate CDN needed — see
  `../ARCHITECTURE.md`'s "Known rough edges"), builds the backend itself,
  then a production stage with the compiled output + full `node_modules`
  (kept, not trimmed to `--omit=dev`, specifically so `prisma migrate
  deploy` has the `prisma` CLI available at container start — a deliberate
  simplicity-over-image-size tradeoff at this project's scale).
- `frontend/Dockerfile` — builds the Vite app (`VITE_API_URL` baked in at
  build time via `ARG`/`ENV`, since Vite env vars are compile-time, not
  runtime — the built JS bundle literally contains this URL string), served
  by nginx with an SPA fallback (`frontend/nginx.conf`: any non-file path
  serves `index.html` so client-side routing works).
- `postgres:16-alpine` — official image, a named volume for data
  persistence.

Build context for the backend is `saas/` (not `saas/backend/`) specifically
so its Dockerfile can `COPY widget/ ...` — see the comment at the top of
`backend/Dockerfile`.

## What was and wasn't verified, and why (read this before assuming Docker works end-to-end)

This was built and is verified against a **real** running Docker daemon —
not assumed. `service docker start` fails in this sandbox (a `ulimit`
permission error in the init script), but running `dockerd` directly
succeeds and `docker info`/`docker compose config` work normally against
it. This is worth stating precisely because it would have been easy to
wrongly conclude "the daemon doesn't run here" from the init script alone.

What genuinely **failed**, with evidence: pulling the `node:22-slim` base
image errors with `Forbidden` from
`production.cloudfront.docker.com` — the same signature (`CONNECT tunnel
failed, response 403`, confirmed independently with `curl`) as every other
non-allowlisted external host reached during this whole build (this
sandbox's egress proxy permits only `anthropic.com`, the npm registry,
PyPI, crates.io, the Go module proxy, and jsr.io — Docker Hub's CDN is not
on that list). So a full `docker compose up --build` could not be run
end-to-end here. This is an infrastructure constraint of the sandbox, not a
defect in these Dockerfiles or compose file.

What **was** actually verified, for real, in this sandbox:

- `docker compose config` — the full compose file parses, all variable
  interpolation from `.env` resolves correctly (service env vars, build
  args, healthchecks, volumes, port mappings, `depends_on` conditions all
  print correctly resolved).
- `docker compose build --dry-run` — both the `backend` and `frontend`
  build plans (including the backend's `widget-builder` →
  `backend-builder` → `production` multi-stage `COPY --from=` references)
  resolve and validate without a Dockerfile syntax/reference error.
- A real `docker build` on the backend image got far enough to correctly
  parse the Dockerfile and start resolving the base image before hitting
  the network block — i.e. the Dockerfile syntax itself is not the failure.
- **Caught and fixed a real bug this way**: the original backend Dockerfile
  copied only `package.json`/`package-lock.json` before running `npm ci`
  (a common Docker layer-caching pattern), but `npm ci` triggers the
  `postinstall` script (`prisma generate`), which needs
  `prisma/schema.prisma` — not copied yet at that point. Reproduced outside
  Docker (copied just those files into an isolated temp directory and ran
  `npm ci` — it failed with `prisma/schema.prisma: file not found`, exactly
  as it would have inside the image build), fixed by copying `prisma/` and
  `prisma.config.ts` alongside `package.json` before `npm ci`, then
  reproduced again to confirm the fix (`npm ci` now succeeds, `prisma
  generate` runs correctly as part of `postinstall`).
- `npm ci` was also verified to succeed cleanly, isolated, for `frontend`
  and `widget` (no equivalent postinstall dependency issue there).
- The application logic these images package is **not** newly-trusted —
  it's the same code exercised via real `node dist/index.js` runs against a
  real PostgreSQL instance and real headless-Chromium browser sessions
  throughout every phase of this build (see each phase's own commit
  message). Docker is a packaging concern on top of already-verified
  application behavior, not a first test of whether the app works.

**What this means for whoever runs this next**: the first `docker compose
up --build` in an environment with real internet access to Docker Hub is
the actual full end-to-end verification of the container packaging layer
(as opposed to the application logic, which is already verified). Treat it
as that, not as a formality — a full compose run could still surface
something the dry-run/config/npm-ci checks above can't catch (e.g. a
runtime-only issue inside the container, or the healthcheck's exact
behavior).

## Production hardening not done here (disclosed, not silently skipped)

- No TLS termination configured (add a reverse proxy — Caddy, nginx with
  certbot, or a cloud load balancer — in front of both `frontend` and
  `backend`; this compose file is HTTP-only, meant for behind such a proxy
  or for local testing).
- No log aggregation/shipping.
- No image vulnerability scanning in a CI pipeline (npm reports moderate/
  high-severity advisories in `npm audit` for both backend and frontend as
  of this writing — normal for a fresh `npm install` of a small dependency
  tree, not urgent, but worth a look before a real production launch).
- Single-instance Postgres, no backup/replication configured.
- Backend runs `prisma migrate deploy` on every container start; fine for
  a single instance, would need to move to a separate one-off migration
  step before scaling to multiple backend replicas (documented in
  `backend/Dockerfile`'s comment on the `CMD`).
