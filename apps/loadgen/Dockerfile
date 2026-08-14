# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /repo

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
COPY apps/loadgen apps/loadgen
RUN npm run build -w @logs/shared && npm run build -w @logs/loadgen

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/package.json ./package.json
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/packages/shared/package.json packages/shared/package.json
COPY --from=build /repo/apps/loadgen/dist apps/loadgen/dist
COPY --from=build /repo/apps/loadgen/package.json apps/loadgen/package.json

USER node
# docker-compose.yml's `command:` on the loadgen service is passed as args
# to this entrypoint, e.g. ["--rate", "500", "--duration", "60"].
ENTRYPOINT ["node", "apps/loadgen/dist/index.js"]
