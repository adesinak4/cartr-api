# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- deps: install once, reused by both the build and runtime stages ----
# Kept un-pruned (dev deps included) deliberately: `pnpm migrate` (a ts-node
# script) needs to be runnable directly inside the deployed container via
# `docker exec` / a Coolify one-off command — this is a small self-hosted
# app, not a project with a separate CI pipeline that has its own access to
# the production database.
#
# The first admin account is NOT manual — AdminSeedService seeds it
# automatically on every app boot (idempotent: skips if ADMIN_SEED_EMAIL
# already exists), as long as ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD are set
# in the deploy environment. `pnpm seed:admin` still exists as a one-off
# manual fallback (e.g. to seed a second admin with different credentials).
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
