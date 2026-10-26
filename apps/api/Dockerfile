# Slim production image for the API (Express + tRPC).
# Build from the repo root:  docker build -f apps/api/Dockerfile .
#
# tsup bundles the @repo/* workspace packages (and their libraries) into dist/index.js, so the
# runtime only needs the API's own production dependencies - no TypeScript, tsup, eslint, turbo,
# vitest or source code.

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
COPY apps/api ./apps/api
RUN pnpm --filter @repo/api run build

# ---- prod-deps: only the API's production node_modules ----
FROM pnpm AS prod-deps
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod --filter @repo/api

# ---- runner: plain Node (no pnpm), non-root ----
FROM node:24-alpine AS runner
ENV NODE_ENV=production \
    CARD_FONTS_DIR=/app/fonts
WORKDIR /app
COPY --from=prod-deps /app ./
COPY --from=builder /app/apps/api/dist ./apps/api/dist
# Card fonts: the API can still render cards inline when ASSET_JOBS_INLINE=1
COPY packages/services/card/fonts ./fonts
WORKDIR /app/apps/api
USER node
EXPOSE 8000
# Started directly (not through pnpm): saves ~100 MB RAM and lets SIGTERM reach Node.
# docker-compose adds `init: true` for signal handling/reaping.
CMD ["node", "dist/index.js"]
