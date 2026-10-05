# syntax=docker/dockerfile:1
# Build context: repository root  →  docker build -f backend/Dockerfile .

FROM node:26-alpine AS build
WORKDIR /repo
RUN corepack enable

# Install dependencies first (cached layer while lockfile is unchanged).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @pj20/backend...

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY backend backend
RUN pnpm --filter @pj20/backend build \
  && pnpm --filter @pj20/backend deploy --prod --legacy /out

FROM node:26-alpine AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4400
WORKDIR /srv
COPY --from=build --chown=node:node /out/package.json ./
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/backend/dist ./dist

# Never run as root (CLAUDE.md §7.1).
USER node
EXPOSE 4400
CMD ["node", "--enable-source-maps", "dist/server.js"]
