# Peshkar AI — AI E‑Commerce Studio

Turn a raw phone photo into a complete, marketplace‑ready listing in seconds:
studio‑grade product images, SEO catalog copy, and branded social cards — built
for Indian D2C brands and resellers on Meesho, Amazon, Flipkart and WhatsApp.

Pay‑as‑you‑go credits (~₹10/credit), no subscription. See [PRODUCT.md](./PRODUCT.md)
for the full product definition.

---

## Architecture

This is a **pnpm + Turborepo** monorepo. Three deployable apps sit on top of
shared packages:

```
┌─────────────┐     tRPC/HTTP      ┌─────────────┐
│  apps/web   │ ─────────────────▶ │  apps/api   │
│ Next.js 16  │                    │  Express +  │
│ React 19    │ ◀───────────────── │   tRPC      │
└─────────────┘   status polling   └──────┬──────┘
                                          │ enqueue (BullMQ)
                                          ▼
                                   ┌─────────────┐
                                   │ apps/worker │  image gen, re-edit,
                                   │   BullMQ    │  card rendering
                                   └──────┬──────┘
                                          │
          MongoDB (Mongoose) ◀────────────┼────────────▶ Cloudflare R2 (images)
          Redis (queue + rate limit) ◀────┘              OpenAI + Gemini (AI)
```

| Path | What it is |
|------|------------|
| `apps/web` | Next.js 16 App Router frontend (React 19, Tailwind v4, tRPC client, Clerk auth). |
| `apps/api` | Express server exposing the tRPC router (+ OpenAPI), Clerk & Razorpay webhooks. |
| `apps/worker` | BullMQ consumers: studio image generation, photo re-edit, social card rendering. |
| `packages/trpc` | tRPC router, procedures and context (the API surface). |
| `packages/services` | Domain logic: credits, payments, referrals, R2 storage, AI, queue, rate limiting. |
| `packages/database` | Mongoose models (`User`, `ListingObject`, `Payment`) and the connection helper. |
| `packages/logger` | Shared Winston logger. |
| `packages/eslint-config`, `packages/typescript-config` | Shared ESLint (flat) and tsconfig presets. |

### How a generation flows

1. Web requests a presigned R2 URL and uploads the photo directly to storage.
2. `upload.confirmUpload` creates a `ListingObject` (keys are verified to belong
   to the caller).
3. `generate.startGeneration` deducts credits **atomically** and enqueues a
   BullMQ job. If enqueue fails, the credits are refunded (compensating txn).
4. The worker enhances the prompt, calls Gemini (images) + OpenAI (copy) in
   parallel, renders cards with Sharp, uploads results to R2, and marks the
   listing `completed`. On exhausted retries it auto‑refunds the credits once.
5. Web polls `generate.getStatus` on an adaptive interval until done.

---

## Prerequisites

- Node.js **>= 20** (CI runs on 20)
- pnpm **9**
- Docker (for local MongoDB + Redis), or your own instances

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Create your .env (copies .env.example and links it into each package)
bash setup.sh
#   then fill in the secrets in .env (see "Environment variables" below)

# 3. Start MongoDB + Redis locally
docker compose up -d        # starts mongodb + redis from docker-compose.yml

# 4. Run everything in dev (web + api + worker via Turborepo)
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001 (OpenAPI docs at `/docs`)

## Common commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run all apps in watch mode. |
| `pnpm build` | Build all apps and packages. |
| `pnpm check-types` | Type-check every package (`tsc --noEmit`). |
| `pnpm lint` | Lint every package (ESLint flat config). |
| `pnpm test` | Run unit tests (Vitest) across packages. |
| `pnpm test:e2e` | Run the end-to-end credit/refund/render script (needs DB + Redis). |
| `pnpm format` | Prettier across the repo. |

Filter to one package with Turborepo, e.g. `pnpm dev --filter web`.

## Testing

Unit tests use **Vitest** and live next to the code they cover
(`packages/services/__tests__`, `apps/web/lib/*.test.ts`). They focus on the
money-critical logic: credit pricing, payment signature verification, and the
polling cadence. The pricing table is duplicated in the web and services test
files on purpose, so the client quote and the server charge can never drift.

```bash
pnpm test                     # all packages
pnpm --filter @repo/services test
```

---

## Environment variables

Copy `.env.example` to `.env` and fill these in. A single root `.env` is linked
into each package by `setup.sh`.

**Core**
- `NODE_ENV`, `PORT`, `BASE_URL`, `FRONTEND_URL`, `ALLOWED_ORIGINS`

**Datastores**
- `MONGODB_URI`, `MONGO_INITDB_ROOT_USERNAME/PASSWORD`, `MONGO_INITDB_DATABASE`
- `REDIS_URL`

**Auth — Clerk**
- `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `SIGN_UP_URL` / `AFTER_SIGN_IN_URL` / `AFTER_SIGN_UP_URL`

**Storage — Cloudflare R2**
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`

**Payments — Razorpay**
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`

**AI**
- `OPENAI_API_KEY`, `GEMINI_API_KEY`

**Frontend / analytics**
- `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `LOGGER_LEVEL`

> In production the apps validate required secrets at startup and refuse to run
> with placeholder values — a missing key is a hard failure, not a silent default.

---

## Deployment

- **web** → any Next.js host (Vercel or container; `apps/web/Dockerfile` provided).
- **api** and **worker** → containers (`apps/api/Dockerfile`, `apps/worker/Dockerfile`);
  `docker-compose.server.yml` and `Caddyfile.production` show a reference server setup.
- CI (`.github/workflows/ci.yml`) runs typecheck → lint → test → build on every push/PR.

## Tech stack

Next.js 16 · React 19 · Tailwind CSS v4 · tRPC · TanStack Query · Zustand ·
Express · BullMQ · MongoDB/Mongoose · Redis · Cloudflare R2 · Clerk · Razorpay ·
OpenAI · Google Gemini · PostHog · Turborepo · Vitest.
