# syntax=docker/dockerfile:1
# Build context: repository root  →  docker build -f app/Dockerfile .

FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY app/package.json app/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @pj20/app...

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY app app
# Public OAuth client id, baked into the bundle at build time (it is not a secret).
# Easypanel passes service environment variables as build arguments.
ARG VITE_GOOGLE_CLIENT_ID
# Public https address of this deployment (link previews: WhatsApp, Telegram…). Optional.
ARG VITE_PUBLIC_URL
RUN test -n "$VITE_GOOGLE_CLIENT_ID" || { echo "Falta VITE_GOOGLE_CLIENT_ID (argumento de compilación)" >&2; exit 1; }
RUN pnpm --filter @pj20/app build

# Static files served by an unprivileged nginx (listens on 8080, runs as non-root).
FROM nginxinc/nginx-unprivileged:1.30-alpine AS runtime
COPY app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/app/dist /usr/share/nginx/html
EXPOSE 8080
