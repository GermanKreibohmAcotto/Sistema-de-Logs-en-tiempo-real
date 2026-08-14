# syntax=docker/dockerfile:1
# Build context is the repo root (see docker-compose.yml) - a workspace
# needs its siblings' package.json files present for `npm ci` to resolve.
FROM node:22-alpine AS base
WORKDIR /repo

# Only manifest files first, so this layer (the slow one) is cached across
# builds unless a dependency actually changed.
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/loadgen/package.json apps/loadgen/package.json
RUN npm ci

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @logs/shared && npm run build -w @logs/api

# Reuses the full node_modules (including devDependencies) from the deps
# stage rather than a second `npm ci --omit=dev` pass, which is simpler and
# more robust across shared workspace packages at the cost of image size -
# worth revisiting if that size becomes a real constraint.
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/package.json ./package.json
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/packages/shared/package.json packages/shared/package.json
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/package.json apps/api/package.json

EXPOSE 4000
USER node
# Migrations are idempotent (tracked in schema_migrations), so running them
# on every container start is safe and means `docker compose up` alone is
# enough to get a working stack - no separate one-off migrate step to remember.
CMD ["sh", "-c", "node apps/api/dist/db/migrate.js && node apps/api/dist/server.js"]
