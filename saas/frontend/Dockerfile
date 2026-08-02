# VITE_API_URL is baked in at build time (Vite env vars are compile-time,
# not runtime) — pass it as a build arg so the same image isn't silently
# wrong for a different backend URL. See docker-compose.yml.
ARG VITE_API_URL=http://localhost:4000

FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:1.27-alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
