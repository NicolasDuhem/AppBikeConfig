# tp2-cpq-app (extracted from AppBikeConfig)

## Purpose
`tp2-cpq-app` is a CPQ-only Next.js application focused on:
- CPQ Bike Builder runtime flow (`/cpq`)
- CPQ sampler result persistence and visual result browsing (`/cpq/results`)
- CPQ setup for:
  - Account code management
  - Ruleset management
  - Picture management (`/cpq/setup`)

All unrelated domains (admin, users, feature flags, product setup, sales/country matrix, legacy SKU tooling) were removed.

## Branch strategy
This repository assumes two long-lived branches:
- `staging`: integration and validation branch
- `main`: production branch

Recommended flow: feature branches -> `staging` -> `main`.

## Local setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create env file:
   ```bash
   cp .env.example .env.local
   ```
3. Initialize DB schema:
   ```bash
   psql "$DATABASE_URL" -f sql/schema.sql
   psql "$DATABASE_URL" -f sql/seed.sql
   ```
4. Start dev server:
   ```bash
   npm run dev
   ```

## Required environment variables
### Database
- `DATABASE_URL`: PostgreSQL connection string.

### CPQ runtime integration
- `CPQ_API_KEY` (required when not using mock mode)
- `CPQ_BASE_URL`
- `CPQ_TIMEOUT_MS`
- `CPQ_INSTANCE`
- `CPQ_PROFILE`
- `CPQ_NAMESPACE`
- `CPQ_PART_NAME`
- `CPQ_ACCOUNT_TYPE`
- `CPQ_CURRENCY`
- `CPQ_COMPANY`
- `CPQ_CUSTOMER_LOCATION`
- `CPQ_HEADER_ID`
- `CPQ_DETAIL_ID`

### Optional
- `CPQ_USE_MOCK=true` to run CPQ init/configure against mock data.

## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Start: `npm run start`

## Deploy notes
- Build artifact is standard Next.js output.
- Ensure DB schema is applied before deployment.
- Ensure runtime env vars are configured in deployment environment.
