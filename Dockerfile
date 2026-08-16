# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- deps: install once, reused by both the build and runtime stages ----
# Kept un-pruned (dev deps included) deliberately: `pnpm migrate` and
# `pnpm seed:admin` (both ts-node scripts) need to be runnable directly
# inside the deployed container via `docker exec` / a Coolify one-off
# command — this is a small self-hosted app, not a project with a separate
# CI pipeline that has its own access to the production database.
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build: compile TypeScript ----
FROM deps AS build
COPY . .
RUN pnpm build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production

RUN addgroup -S cartr && adduser -S cartr -G cartr

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY scripts ./scripts
COPY drizzle.config.ts ./
COPY migrations ./migrations

USER cartr

EXPOSE 3000
CMD ["node", "dist/main.js"]
