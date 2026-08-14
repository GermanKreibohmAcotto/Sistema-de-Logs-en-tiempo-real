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
COPY apps/web apps/web
RUN npm run build -w @logs/shared
# Same-origin in production: nginx (below) proxies /v1 and /ws to the api
# container, so the SPA never needs a separate host or CORS at runtime.
ENV VITE_API_BASE_URL=""
ENV VITE_WS_URL="/ws"
RUN npm run build -w @logs/web

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 80
