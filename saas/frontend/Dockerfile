# NOTE: written to standard Node+Nginx Docker practice but NOT build-tested
# — this sandbox has no `docker` binary available. Verify with
# `docker build .` before relying on this in production; see saas/README.md.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
