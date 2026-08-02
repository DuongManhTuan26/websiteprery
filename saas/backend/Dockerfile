# Build context is saas/ (the parent directory), not saas/backend — the
# backend serves the widget bundle at runtime (GET /widget.js) and needs
# access to saas/widget's source to build it into this image.
# docker-compose.yml sets `context: .` with `dockerfile: backend/Dockerfile`.

FROM node:22-slim AS widget-builder
WORKDIR /widget
COPY widget/package.json widget/package-lock.json ./
RUN npm ci
COPY widget/ ./
RUN npm run build

FROM node:22-slim AS backend-builder
WORKDIR /app
# prisma/schema.prisma must be present before `npm ci` — package.json's
# postinstall hook runs `prisma generate`, which fails without it (caught
# by actually running `npm ci` against this exact layer order before this
# fix existed). Slightly reduces the dependency-layer cache's hit rate
# (a schema-only change now also invalidates it) in exchange for a build
# that isn't broken.
COPY backend/package.json backend/package-lock.json ./
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./prisma.config.ts
RUN npm ci
COPY backend/ ./
RUN npm run build

# Production image keeps the full node_modules from the builder stage
# (including devDependencies) rather than a separate `npm ci --omit=dev`
# pass, specifically because `prisma migrate deploy` (run at container
# startup, see CMD below) needs the `prisma` CLI package, not just the
# generated @prisma/client. Trades a larger image for a simpler, more
# obviously-correct build — a reasonable choice at this project's scale.
FROM node:22-slim AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/prisma ./prisma
COPY --from=backend-builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=backend-builder /app/package.json ./package.json
COPY --from=widget-builder /widget/dist ./widget-dist

ENV WIDGET_DIST_DIR=/app/widget-dist
ENV PORT=4000
EXPOSE 4000

# Migrations run on container start, before the server binds — acceptable
# for this project's single-instance docker-compose deployment (would need
# to move to a separate one-off migrate step for a multi-replica setup).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
