# AppBikeConfig — Full Architecture, Data Model, API, Processes, Authentication & RBAC

## Purpose

AppBikeConfig is a Brompton internal product-configuration and market-availability tool built on:

- **Next.js** for frontend and backend routes
- **Neon Postgres** for data storage
- **Vercel** for hosting and deployment

The tool currently supports:

- product matrix maintenance
- market/country availability
- setup option management
- SKU digit definition
- bike builder / combination generator
- push generated rows into the matrix

The medium-term direction is for the tool to become a **market-aware product availability and configuration service** that can also feed the B2B storefront.

---

## Current Functional Scope

### 1. Matrix
The Matrix is the operational maintenance page.

It supports:
- product row creation
- product field editing
- country creation
- dynamic availability by country
- matrix display driven by:
  - products
  - countries
  - availability
- single-row save/update
- bulk update of availability
- permission-aware UI actions

### 2. Order
The Order page is a filtered consumption view.

It supports:
- country selection
- cascading option filtering
- show/hide unavailable options logic
- product tile display
- login-protected access

### 3. Setup
Setup manages dropdown option values used by the app.

Examples:
- Handlebar
- Speed
- Rack
- Bike type
- Colour
- Light
- Seatpost length
- Saddle

It now also respects role-based access for write actions.

### 4. Bike SKU Definition
This page manages the SKU digit logic.

It supports:
- viewing digit-position rules
- previewing SKU composition
- evolving the SKU-definition engine over time
- permission-aware write behavior

### 5. Bike Builder
This page generates combinations from selected options.

It supports:
- multi-selecting allowed values
- generating combinations
- generating SKU codes from rules
- selecting the combinations to keep
- pushing selected rows into the Matrix
- permission-aware push behavior

### 6. Users
A sys-admin-only management page exists for user administration.

It supports:
- create user
- set initial password
- assign roles
- activate/deactivate users

---

## Architecture

## High-level architecture

```text
Browser
  -> Next.js frontend
  -> Next.js API routes / server-side code
  -> Neon Postgres
```

### Why this architecture
This keeps database credentials server-side only and avoids exposing database access to the browser.

---

## Project Structure

```text
AppBikeConfig/
  app/
    api/
      auth/[...nextauth]/
      builder-push/
      countries/
      matrix/
      matrix/bulk-update/
      me/
      roles/
      setup-options/
      sku-rules/
      users/
    bike-builder/
    login/
    matrix/
    order/
    setup/
    sku-definition/
    users/
    globals.css
    layout.tsx
    page.tsx

  components/
    logout-button.tsx

  lib/
    api-auth.ts
    audit.ts
    auth.ts
    db.ts
    rbac.ts
    types.ts

  sql/
    schema.sql
    seed.sql
    002_auth_rbac.sql

  middleware.ts
  next-auth.d.ts
  .env.example
  package.json
  README.md
```

---

## Data Model

The app is intentionally normalized.

### 1. products
Stores product-level attributes only.

**Columns**
- `id`
- `sku_code`
- `handlebar`
- `speed`
- `rack`
- `bike_type`
- `colour`
- `light`
- `seatpost_length`
- `saddle`
- `description`
- `created_at`
- `updated_at`

### Why
Product data should not contain one column per country. Country availability is handled separately.

---

### 2. countries
Stores country and region definitions.

**Columns**
- `id`
- `country`
- `region`
- `created_at`

### Why
Country columns in the Matrix are dynamically built from this table.

---

### 3. availability
Stores whether a product is sellable in a country.

**Columns**
- `product_id`
- `country_id`
- `available`
- `updated_at`

**Primary key**
- `(product_id, country_id)`

### Why
This replaces the old "wide matrix with country columns physically stored in the data source".

This structure is:
- scalable
- easier to query
- cleaner for API use
- ready for future SQL usage by storefront or integrations

---

### 4. sku_rules
Stores the SKU digit engine.

**Columns**
- `id`
- `digit_position`
- `option_name`
- `code_value`
- `choice_value`
- `description_element`

### Why
This lets the SKU logic evolve without rewriting code.

---

### 5. setup_options
Stores generic selectable options for the UI.

**Columns**
- `id`
- `option_name`
- `choice_value`
- `sort_order`

### Why
This keeps dropdown/list values data-driven rather than hardcoded.

---

## Implemented Login + Roles Tables

### 6. app_users
Stores users who can access the application.

**Columns**
- `id bigserial primary key`
- `email text not null unique`
- `password_hash text not null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

---

### 7. roles
Stores application roles.

**Columns**
- `id bigserial primary key`
- `role_key text not null unique`
- `role_name text not null`

**Seed values**
- `sys_admin`
- `sales_admin`
- `sales_standard`
- `product_admin`
- `read_only`

---

### 8. user_roles
Maps users to roles.

**Columns**
- `user_id bigint not null references app_users(id) on delete cascade`
- `role_id bigint not null references roles(id) on delete cascade`
- `primary key (user_id, role_id)`

---

### 9. audit_log
Traceability table for important mutations.

**Columns**
- `id bigserial primary key`
- `user_id bigint references app_users(id)`
- `action_key text not null`
- `entity_type text not null`
- `entity_id text`
- `old_data jsonb`
- `new_data jsonb`
- `created_at timestamptz not null default now()`

---

### 10. optional: user_country_scopes
Not implemented yet, but recommended if later you want users restricted to countries or regions.

**Suggested columns**
- `user_id bigint not null references app_users(id) on delete cascade`
- `country_id bigint references countries(id) on delete cascade`
- `region text`
- `scope_type text not null`
- `primary key (user_id, country_id, region, scope_type)`

---

## RBAC Model

## Required roles

### sys_admin
Full access.

Can:
- access everything
- create users
- assign roles
- add/edit/delete countries
- bulk update matrix
- one-by-one update matrix
- manage SKU rules
- use Bike Builder
- push to Matrix
- manage setup options
- activate/deactivate users

### sales_admin
Commercial maintenance power user.

Can:
- access Matrix
- one-by-one update matrix
- bulk update matrix
- add country
- read Order page
- read setup
- cannot manage users
- cannot manage SKU rules
- cannot use Bike Builder push flow unless explicitly granted later

### sales_standard
Operational sales user.

Can:
- access Matrix
- update one row at a time
- update availability one-by-one
- read Order page
- cannot bulk update
- cannot add country
- cannot manage setup
- cannot manage SKU rules
- cannot push from Bike Builder

### product_admin
Configuration and product-definition user.

Can:
- access Bike SKU Definition
- access Bike Builder
- push generated products to Matrix
- manage setup options
- manage SKU rules
- optionally read Matrix
- should not manage users
- should not bulk update market availability unless you want that later

### read_only
Read-only access for everyone else.

Can:
- view Matrix
- view Order
- view SKU definitions if desired

Cannot:
- change data
- push data
- add countries
- bulk update

---

## Permission Matrix

| Action | sys_admin | sales_admin | sales_standard | product_admin | read_only |
|---|---|---:|---:|---:|---:|
| Login | yes | yes | yes | yes | yes |
| View Matrix | yes | yes | yes | optional | yes |
| Edit Matrix one-by-one | yes | yes | yes | optional | no |
| Bulk update Matrix | yes | yes | no | no | no |
| Add country | yes | yes | no | no | no |
| Manage setup options | yes | optional | no | yes | no |
| Manage SKU rules | yes | no | no | yes | no |
| Use Bike Builder | yes | no | no | yes | no |
| Push builder rows to Matrix | yes | no | no | yes | no |
| Add users | yes | no | no | no | no |
| Assign roles | yes | no | no | no | no |
| Activate / deactivate users | yes | no | no | no | no |

---

## Best Authentication Approach

## Implemented approach
The app now uses **Auth.js / NextAuth credentials login** with:

- email + password
- bcrypt password verification
- JWT session strategy
- middleware-based route protection
- server-side authorization checks in mutating API routes

### Why this is the best fit
For the current requirements:
- login is required
- user creation is internal/admin controlled
- roles are application-specific
- the system already uses Neon
- social login / SSO is not required first

### Important design rule
Do not rely on hiding buttons only.

Every API route that changes data must check:
- current logged-in user
- current role(s)
- whether that action is allowed

UI restrictions are convenience only. Backend checks are the source of truth.

---

## Authentication Flow

### Login
1. User enters email + password
2. Password is checked against `app_users.password_hash`
3. Session is created
4. Protected pages require session
5. JWT stores the current `userId`
6. Session callback exposes the current user id to server-side helpers

### Authorization
Each important API route checks whether the current user can perform the action.

Examples:
- `/api/matrix/bulk-update` -> only `sys_admin`, `sales_admin`
- `/api/countries` POST -> only `sys_admin`, `sales_admin`
- `/api/builder-push` POST -> only `sys_admin`, `product_admin`
- `/api/users` -> only `sys_admin`

### Current helpers in `lib/auth.ts`
- `getCurrentSession`
- `getCurrentUser`
- `getCurrentUserRoles`
- `requireLogin`
- `requireRole`

### Current helper in `lib/rbac.ts`
- role-to-action mapping
- `can(actionKey)` style permission evaluation

### Current middleware
- `middleware.ts` protects all non-public pages
- `/login` remains public
- authenticated session is required for the app

---

## API Design — Business Data

## `/api/matrix`
### GET
Returns:
- products
- countries
- availability merged into matrix rows

### POST
Creates or updates a product row and its availability

**Current write roles**
- `sys_admin`
- `sales_admin`
- `sales_standard`

**Audited**
- yes

---

## `/api/matrix/bulk-update`
### POST
Bulk updates availability across selected/filtered records.

**Current write roles**
- `sys_admin`
- `sales_admin`

**Audited**
- yes

---

## `/api/countries`
### GET
Returns:
- list of countries and regions

### POST
Creates or updates a country

**Current write roles**
- `sys_admin`
- `sales_admin`

**Audited**
- yes

---

## `/api/setup-options`
### GET
Returns:
- list of setup options

### POST
Adds a setup option

### DELETE
Deletes a setup option

**Current write roles**
- `sys_admin`
- `product_admin`

**Audited**
- yes

---

## `/api/sku-rules`
### GET
Returns:
- list of SKU rules

### POST
Adds a SKU rule

**Current write roles**
- `sys_admin`
- `product_admin`

**Audited**
- yes

---

## `/api/builder-push`
### POST
Accepts generated rows from Bike Builder and inserts/updates products in the Matrix

**Current write roles**
- `sys_admin`
- `product_admin`

**Audited**
- yes

---

## API Design — Auth/RBAC

## `/api/auth/[...nextauth]`
Handled by Auth.js / NextAuth.

Purpose:
- login
- logout
- session

---

## `/api/me`
Returns:
- current user
- current roles
- computed permissions for UI gating

Used by UI for:
- hiding buttons
- disabling restricted actions
- page-level action awareness

No secrets are returned.

---

## `/api/users`
### GET
List users  
**Role required**: `sys_admin`

### POST
Create user  
**Role required**: `sys_admin`

### PATCH
Update active flag, password reset, etc.  
**Role required**: `sys_admin`

**Audited**
- yes

---

## `/api/roles`
### GET
List roles  
**Role required**: `sys_admin`

---

## `/api/user-roles`
Not currently split as a separate route in the current implementation if role assignment is handled within `/api/users`, but conceptually this remains a valid model for future refactor.

---

## Process Flows

## Matrix flow
1. Read `products`
2. Read `countries`
3. Read `availability`
4. Build dynamic matrix
5. Save row updates back through API
6. Enforce role check before write
7. Write audit log

---

## Matrix bulk update flow
1. User chooses a bulk update action
2. UI checks permission via `/api/me`
3. API enforces `sys_admin` or `sales_admin`
4. Matching rows are updated
5. Audit row is written to `audit_log`

---

## Order flow
1. User chooses country
2. App filters rows where availability is true
3. Cascading filters narrow product selection
4. Product tiles are displayed

---

## Setup flow
1. User adds or removes setup options
2. Setup options feed lists and dropdowns elsewhere in the app
3. API enforces `sys_admin` or `product_admin`
4. Audit row is written

---

## SKU Definition flow
1. User reads digit rules
2. User picks options
3. App builds 30-character SKU
4. Empty digit positions become `_`
5. Write actions require `sys_admin` or `product_admin`

---

## Bike Builder flow
1. User selects allowed values per option
2. App generates cartesian product of selected choices
3. App builds SKU code from rules
4. User ticks valid rows
5. User pushes selected rows into Matrix
6. API enforces `sys_admin` or `product_admin`
7. Audit row is written

---

## User administration flow
1. sys_admin logs in
2. sys_admin opens `/users`
3. sys_admin creates user with email + initial password
4. Password is bcrypt-hashed before storing
5. sys_admin assigns one or multiple roles
6. sys_admin can deactivate/reactivate a user
7. User and role changes are audited

---

## Security Principles

### 1. Database credentials stay server-side
Never expose `DATABASE_URL` to the browser.

### 2. All writes go through server-side API routes
This makes permissions, audit, and future scalability cleaner.

### 3. All mutating routes must enforce role checks
Examples:
- add country
- bulk update
- push to matrix
- create users
- assign roles
- activate/deactivate users

### 4. Use password hashing
Never store raw passwords. Passwords are bcrypt-hashed.

### 5. Add audit logging for important writes
Currently implemented for:
- matrix single updates
- matrix bulk updates
- add country
- builder push
- setup changes
- SKU rule changes
- user creation
- role assignment
- user deactivation/reactivation

### 6. UI restriction is not security
Buttons may be hidden or disabled based on `/api/me`, but the backend remains the authoritative enforcer.

---

## Suggested SQL — Core Tables

### Core business schema
See:
- `sql/schema.sql`
- `sql/seed.sql`

### Auth/RBAC migration
See:
- `sql/002_auth_rbac.sql`

#### Implemented auth/RBAC SQL pattern
```sql
create table if not exists app_users (
  id bigserial primary key,
  email text not null unique,
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists roles (
  id bigserial primary key,
  role_key text not null unique,
  role_name text not null
);

create table if not exists user_roles (
  user_id bigint not null references app_users(id) on delete cascade,
  role_id bigint not null references roles(id) on delete cascade,
  primary key (user_id, role_id)
);

create table if not exists audit_log (
  id bigserial primary key,
  user_id bigint references app_users(id),
  action_key text not null,
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

insert into roles (role_key, role_name)
values
  ('sys_admin', 'System Administrator'),
  ('sales_admin', 'Sales Administrator'),
  ('sales_standard', 'Sales Standard'),
  ('product_admin', 'Product Administrator'),
  ('read_only', 'Read Only')
on conflict (role_key) do nothing;
```

---

## Implemented Auth/RBAC — Current State

### Phase 1 — SQL auth tables + role seeding
Added migration file:
- `sql/002_auth_rbac.sql`

It creates and seeds:
- `app_users`
- `roles`
- `user_roles`
- `audit_log`
- role seeds: `sys_admin`, `sales_admin`, `sales_standard`, `product_admin`, `read_only`

### Phase 2 — Auth.js credentials login + login page + logout
Implemented:
- `next-auth` / Auth.js credentials provider (email + password)
- bcrypt password verification against `app_users.password_hash`
- custom `/login` page
- logout button in layout
- Auth.js route handler under `app/api/auth/[...nextauth]/route.ts`

### Phase 3 — Session helpers + route/page protection
Implemented reusable helpers in `lib/auth.ts`:
- `getCurrentSession`
- `getCurrentUser`
- `getCurrentUserRoles`
- `requireLogin`
- `requireRole`

Added:
- `middleware.ts` to require authentication for all non-public pages
- `lib/rbac.ts` with role->permission mapping and `can(actionKey)` equivalent
- `app/api/me` to expose current user + roles + permissions to UI (no secrets)

### Phase 4 — sys_admin user management
Implemented:
- `/users` page for sys_admin
- `/api/users` (GET/POST/PATCH)
- `/api/roles` (GET)

Supports:
- create user with email + initial password (bcrypt hash)
- assign one or multiple roles
- deactivate/reactivate users

### Phase 5 — API authorization checks
Server-side checks are applied in route handlers:
- `POST /api/countries` -> `sys_admin`, `sales_admin`
- `POST /api/matrix` -> `sys_admin`, `sales_admin`, `sales_standard`
- `POST /api/matrix/bulk-update` -> `sys_admin`, `sales_admin`
- `POST/DELETE /api/setup-options` -> `sys_admin`, `product_admin`
- `POST /api/sku-rules` -> `sys_admin`, `product_admin`
- `POST /api/builder-push` -> `sys_admin`, `product_admin`
- `/api/users*` -> `sys_admin`

### Phase 6 — Bulk update matrix route + UI restriction
Implemented:
- `POST /api/matrix/bulk-update`
- Matrix UI action for bulk availability update by country and optional bike type
- UI disable/hide behavior based on computed permissions from `/api/me`

### Phase 7 — Audit logging
Implemented in `audit_log` for:
- matrix single updates
- matrix bulk updates
- add country
- setup option changes
- SKU rule changes
- builder push
- user creation
- role assignment
- user deactivation/reactivation

Audit helper:
- `lib/audit.ts`

### Security notes
- `DATABASE_URL` remains server-side only via `lib/db.ts`
- Auth.js secret currently uses `AUTH_SECRET`
- No secret is exposed with `NEXT_PUBLIC_`
- Authorization is enforced server-side in API handlers (UI restrictions are convenience only)

---

## Best Approach for Codex

### What Codex should do
Codex should implement changes incrementally, not in one giant uncontrolled rewrite.

### Recommended implementation order for future changes
1. Update SQL tables or migrations first
2. Update server-side helpers if permissions change
3. Update route handler authorization
4. Update audit logging where new writes are added
5. Update UI gating from `/api/me`
6. Update this file

### Codex ground rules
- Never bypass backend authorization
- Never expose secrets client-side
- Never rely on UI hiding as the only protection
- Keep database schema and route contracts synchronized
- When adding a mutating feature:
  - add permission key
  - gate route
  - add audit logging
  - update UI
  - update docs

---

## Suggested Codex Prompt Pattern

For future feature work, use a prompt structure like:

```text
You are modifying a Next.js App Router + Neon Postgres application called AppBikeConfig.

Current app features:
- Matrix
- Order
- Setup
- Bike SKU Definition
- Bike Builder
- Login / RBAC / Users admin
- Auth.js credentials auth
- Neon Postgres
- Vercel deployment

Current protected tables:
- products
- countries
- availability
- sku_rules
- setup_options
- app_users
- roles
- user_roles
- audit_log

Current architecture requirements:
- DATABASE_URL must stay server-side only
- AUTH_SECRET must stay server-side only
- all mutating routes must enforce role checks
- all important writes must be audited
- UI restrictions are convenience only; API remains source of truth

Please implement [FEATURE HERE] with:
1. SQL changes if required
2. API changes
3. RBAC changes
4. audit logging changes
5. UI changes
6. README/doc changes

Return:
- changed files
- new files
- SQL to run
- environment variable changes if any
- local test steps
- Vercel deployment notes
```

---

## Deployment Process After Changes

## Local flow
1. Pull latest repo
2. Review changes
3. Run SQL update script in Neon if needed
4. Update `.env.local` if new env vars are needed
5. Run locally:
   - `npm install`
   - `npm run dev`
   - `npm run build`
6. Test login and permissions

## GitHub flow
1. Commit changes
2. Push to `main` or a branch
3. If Vercel is linked, deployment is triggered automatically

## Vercel flow
- Git push -> Vercel builds and deploys automatically if the repo is connected
- Production usually comes from `main`
- Branches can generate preview deployments depending on your setup

### Current known deployment lessons learned
During implementation, several NextAuth/App Router build issues had to be corrected. Future auth-related changes should be tested with:
- `npm run build` locally
- route-handler imports validated
- login page client-side hooks wrapped correctly (for example `useSearchParams` with `Suspense` pattern)

---

## Environment Variables

### Required
- `DATABASE_URL`
- `AUTH_SECRET`

### Local
Stored in:
- `.env.local`

### Vercel
Stored in:
- Project Settings -> Environment Variables

### Important
- `.env.local` must never be committed
- no secret should be prefixed with `NEXT_PUBLIC_`

---

## Deployment Limits / Notes

Vercel and Neon are suitable for the current scale of this tool.

General practical notes:
- Git push to connected repo triggers deployment
- env var changes require redeploy
- build failures should always be reproduced with `npm run build` locally before debugging Vercel

---

## Recommended Immediate Next Steps

1. Stabilize the auth/RBAC implementation and verify each role end-to-end
2. Add a seed/bootstrap script for creating the first sys_admin user more easily
3. Improve README with exact first-user creation steps
4. Consider adding export/import for Matrix
5. Consider adding country/region scoped permissions later
6. Consider future SSO (e.g. Azure AD) if Brompton wants corporate login

---

## Summary

This tool is now best thought of as:

- a product matrix manager
- a market availability manager
- a SKU digit engine
- a bike combination generator
- an early CPQ-like internal platform
- a permissioned internal application
- a future service for the B2B storefront

The current architecture milestone achieved is:

- **Neon-backed normalized data model**
- **Next.js server-side API layer**
- **Vercel deployment**
- **required login**
- **role-based access control**
- **audit logging**
- **sys_admin user management**

Future work should preserve these principles:
- normalized data
- server-side security
- explicit permissions
- auditability
- incremental changes
