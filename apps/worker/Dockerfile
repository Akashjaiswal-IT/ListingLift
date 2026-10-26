# Slim production image for the BullMQ worker.
# Build from the repo root:  docker build -f apps/worker/Dockerfile .
#
# tsup bundles the @repo/* workspace packages (and their libraries) into dist/index.js, so the
# runtime only needs the worker's own production dependencies (sharp, mongoose, bullmq, ioredis,
# pdfkit, dotenv, zod) - no TypeScript, tsup, eslint, turbo, vitest or source code.

# ---- pnpm + root workspace files (build stages only) ----
FROM node:24-alpine AS pnpm
RUN npm install -g pnpm@9.0.0
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./

# ---- builder: all dependencies + tsup build ----
FROM pnpm AS builder
# Manifests first: the install layer stays cached until a package.json or the lockfile changes
COPY packages/database/package.json          packages/database/
COPY packages/eslint-config/package.json     packages/eslint-config/
COPY packages/logger/package.json            packages/logger/
COPY packages/services/package.json          packages/services/
COPY packages/trpc/package.json              packages/trpc/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY apps/api/package.json                   apps/api/
COPY apps/worker/package.json                apps/worker/
RUN pnpm install --frozen-lockfile
COPY packages ./packages
COPY apps/worker ./apps/worker
RUN pnpm --filter @repo/worker run build

# ---- prod-deps: only the worker's production node_modules ----
FROM pnpm AS prod-deps
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile --prod --filter @repo/worker

# ---- runner: plain Node (no pnpm), non-root ----
FROM node:24-alpine AS runner
ENV NODE_ENV=production \
    CARD_FONTS_DIR=/app/fonts
WORKDIR /app
COPY --from=prod-deps /app ./
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
# Card fonts (packages/services/card/card-text.ts getFontsDir() reads CARD_FONTS_DIR first)
COPY packages/services/card/fonts ./fonts
WORKDIR /app/apps/worker
USER node
# Started directly (not through pnpm): saves ~100 MB RAM and lets SIGTERM reach the worker so
# in-flight jobs finish on deploy. docker-compose adds `init: true` for signal handling/reaping.
CMD ["node", "dist/index.js"]
