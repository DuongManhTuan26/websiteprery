# NOTE: written to correct, standard Node.js Docker practice but NOT build-
# tested — this sandbox has no `docker` binary available. Verify with
# `docker build .` before relying on this in production; see saas/README.md.
FROM node:22-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts

RUN npx prisma generate

# Local-disk uploads (storage.service.js's fallback when S3 isn't
# configured) need a writable, persistent path — mount a volume here in
# production, or configure S3_BUCKET/S3_PUBLIC_BASE_URL instead.
RUN mkdir -p uploads
VOLUME ["/app/uploads"]

EXPOSE 4000
CMD ["node", "src/server.js"]
