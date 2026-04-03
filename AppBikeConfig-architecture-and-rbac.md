# AppBikeConfig — Architecture, Data Model, API, Process, Auth/RBAC Plan

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

### 2. Order
The Order page is a filtered consumption view.

It supports:
- country selection
- cascading option filtering
- show/hide unavailable options logic
- product tile display

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

### 4. Bike SKU Definition
This page manages the SKU digit logic.

It supports:
- viewing digit-position rules
- previewing SKU composition
- evolving the SKU-definition engine over time

### 5. Bike Builder
This page generates combinations from selected options.

It supports:
- multi-selecting allowed values
- generating combinations
- generating SKU codes from rules
- selecting the combinations to keep
- pushing selected rows into the Matrix

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
      builder-push/
      countries/
      matrix/
      setup-options/
      sku-rules/
    bike-builder/
    matrix/
    order/
    setup/
    sku-definition/
    globals.css
    layout.tsx
    page.tsx

  lib/
    db.ts
    types.ts

  sql/
    schema.sql
    seed.sql

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

## Suggested New Tables for Login + Roles

To support required login and access control, add these tables.

### 6. app_users
Stores users who can access the application.

**Suggested columns**
- `id bigserial primary key`
- `email text not null unique`
- `password_hash text not null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### 7. roles
Stores application roles.

**Suggested columns**
- `id bigserial primary key`
- `role_key text not null unique`
- `role_name text not null`

**Seed values**
- `sys_admin`
- `sales_admin`
- `sales_standard`
- `product_admin`
- `read_only`

### 8. user_roles
Maps users to roles.

**Suggested columns**
- `user_id bigint not null references app_users(id) on delete cascade`
- `role_id bigint not null references roles(id) on delete cascade`
- `primary key (user_id, role_id)`

### 9. audit_log
Recommended for traceability, especially for matrix and bulk updates.

**Suggested columns**
- `id bigserial primary key`
- `user_id bigint references app_users(id)`
- `action_key text not null`
- `entity_type text not null`
- `entity_id text`
- `old_data jsonb`
- `new_data jsonb`
- `created_at timestamptz not null default now()`

### 10. optional: user_country_scopes
Only add this if later you want users restricted to certain countries/regions.

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

---

## Best Authentication Approach

## Recommended approach
Use **Auth.js** with:
- credentials login
- email + password
- password hashing using `bcrypt`
- session-based auth
- middleware-based route protection
- server-side authorization checks in every mutating API route

### Why this is the best fit
For your requirements:
- login is required
- user creation is internal/admin controlled
- roles are application-specific
- you already have Neon
- you do not need social login first

This is simpler and more aligned than bringing in an external identity platform straight away.

### Important design rule
Do not rely on hiding buttons only.

Every API route that changes data must check:
- current logged-in user
- current role(s)
- whether that action is allowed

---

## Authentication Flow

### Login
1. User enters email + password
2. Password is checked against `password_hash`
3. Session is created
4. Protected pages require session

### Authorization
Each important API route checks whether the current user can perform the action.

Examples:
- `/api/matrix/bulk-update` -> only `sys_admin`, `sales_admin`
- `/api/countries` POST -> only `sys_admin`, `sales_admin`
- `/api/builder-push` POST -> only `sys_admin`, `product_admin`
- `/api/users` -> only `sys_admin`

---

## API Design — Current

## `/api/matrix`
### GET
Returns:
- products
- countries
- availability merged into matrix rows

### POST
Creates or updates a product row and its availability

---

## `/api/countries`
### GET
Returns:
- list of countries and regions

### POST
Creates or updates a country

---

## `/api/setup-options`
### GET
Returns:
- list of setup options

### POST
Adds a setup option

### DELETE
Deletes a setup option

---

## `/api/sku-rules`
### GET
Returns:
- list of SKU rules

### POST
Adds a SKU rule

---

## `/api/builder-push`
### POST
Accepts generated rows from Bike Builder and inserts/updates products in the Matrix

---

## API Design — Recommended New Routes for Auth/RBAC

## `/api/auth/[...nextauth]`
Handled by Auth.js

Purpose:
- login
- logout
- session

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

## `/api/user-roles`
### POST
Assign role to user  
**Role required**: `sys_admin`

### DELETE
Remove role from user  
**Role required**: `sys_admin`

## `/api/matrix/bulk-update`
### POST
Bulk update availability or values across filtered rows  
**Role required**: `sys_admin`, `sales_admin`

---

## Process Flows

## Matrix flow
1. Read `products`
2. Read `countries`
3. Read `availability`
4. Build dynamic matrix
5. Save row updates back through API

## Order flow
1. User chooses country
2. App filters rows where availability is true
3. Cascading filters narrow product selection
4. Product tiles are displayed

## Setup flow
1. User adds or removes setup options
2. Setup options feed lists and dropdowns elsewhere in the app

## SKU Definition flow
1. User reads digit rules
2. User picks options
3. App builds 30-character SKU
4. Empty digit positions become `_`

## Bike Builder flow
1. User selects allowed values per option
2. App generates cartesian product of selected choices
3. App builds SKU code from rules
4. User ticks valid rows
5. User pushes selected rows into Matrix

---

## Security Principles

### 1. Database credentials stay server-side
Never expose `DATABASE_URL` to the browser.

### 2. All writes go through server-side API routes
This makes future permissions and audit easier.

### 3. All mutating routes must enforce role checks
Examples:
- add country
- bulk update
- push to matrix
- create users

### 4. Use password hashing
Never store raw passwords.

### 5. Add audit logging for important writes
Especially:
- bulk updates
- add country
- builder push
- setup changes
- SKU rule changes
- role assignments

---

## Suggested SQL — Auth/RBAC Tables

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

## Best Approach for Codex

### What Codex should do
Codex should implement the auth and role changes incrementally, not in one giant uncontrolled rewrite.

### Recommended implementation order
1. Add SQL tables for users/roles/audit
2. Add Auth.js credentials login
3. Add protected app layout / middleware
4. Add session helpers
5. Add role-check helpers
6. Apply role checks to API routes
7. Add user admin page for sys_admin
8. Add bulk-update route and gate it
9. Add audit logging for critical writes

---

## Codex Prompt

Use this as your starting prompt in Codex:

```text
You are modifying a Next.js 14 + Neon Postgres application called AppBikeConfig.

Current app structure:
- app/
- app/api/
- lib/db.ts
- sql/schema.sql
- product matrix, order page, setup page, sku definition page, bike builder page already exist
- Neon Postgres is already connected through DATABASE_URL

Goal:
Add required login and role-based access control.

Authentication requirements:
- Login is mandatory for the app
- Use email + password
- Use Auth.js credentials-based authentication
- Store users in Postgres
- Store password hashes, never raw passwords
- Use bcrypt for hashing
- Protect pages and API routes

Roles required:
- sys_admin: full access, can add users and assign roles
- sales_admin: can edit matrix, bulk update matrix, add country
- sales_standard: can update matrix one-by-one only, no bulk update, no add country
- product_admin: can use SKU definition, bike builder, and push to matrix
- read_only: read-only access for everything else

Database changes required:
Add tables:
- app_users
- roles
- user_roles
- audit_log
Seed roles:
- sys_admin
- sales_admin
- sales_standard
- product_admin
- read_only

Required behavior:
- All app pages require login
- Add a login page
- Add logout
- Add a user management page for sys_admin only
- Add server-side helpers for:
  - get current session
  - get current user roles
  - require role(s)
- Enforce permissions in API routes:
  - /api/countries POST: sys_admin, sales_admin
  - /api/matrix POST: sys_admin, sales_admin, sales_standard
  - add new /api/matrix/bulk-update: sys_admin, sales_admin
  - /api/setup-options POST/DELETE: sys_admin, product_admin
  - /api/sku-rules POST: sys_admin, product_admin
  - /api/builder-push POST: sys_admin, product_admin
  - /api/users*: sys_admin only
- Add audit logging on:
  - bulk updates
  - add country
  - builder push
  - setup option changes
  - SKU rule changes
  - user creation
  - role assignment

Technical constraints:
- Keep DATABASE_URL server-side only
- Do not expose secrets to client
- Do not remove existing business pages
- Keep code organized and minimal
- Create SQL migration/update script files in sql/
- Update README with setup instructions for auth

Please implement this in small clean steps and show all changed files.
```

---

## Deployment Process After Codex Changes

## Local flow
1. Pull latest repo
2. Review Codex changes
3. Run SQL update script in Neon
4. Update `.env.local` if new env vars are needed
5. Run locally:
   - `npm install`
   - `npm run dev`
6. Test login and permissions

## GitHub flow
1. Commit changes
2. Push to `main` or a branch
3. If your Vercel project is linked to the repo, a deployment is triggered automatically

## Vercel flow
- Git push -> Vercel builds and deploys automatically if the repo is connected
- Production usually comes from `main`
- Branches can generate preview deployments depending on your setup

---

## Vercel Deployment Limits / Notes

On Vercel Hobby, builds are rate-limited to **32 deployments every 3600 seconds (1 hour)**, and Next.js builds count toward that limit. cite: turn774473search0

Vercel’s official pricing page shows **Unlimited Deployments** on the Pro plan. cite: turn774473search10

Vercel documents environment variables as project-level configuration, and database credentials should stay server-side rather than using `NEXT_PUBLIC_` exposure. cite: turn774473search13, turn774473search15

---

## Authentication Library Notes

Auth.js provides a credentials-based authentication provider suitable for a traditional email/password flow, which fits this app’s internal user-management model. cite: turn774473search1, turn774473search3

---

## Recommended Next Implementation Step

If you want the safest progression, do this next:

1. Add auth/RBAC SQL tables
2. Add login page and mandatory authentication
3. Add sys_admin seed user manually
4. Gate all API writes
5. Add user-management page
6. Add bulk-update route
7. Add audit logging

That keeps risk low and gives you a controlled evolution of the app.

---

## Summary

This tool is now best thought of as:

- a product matrix manager
- a market availability manager
- a SKU digit engine
- a bike combination generator
- an early CPQ-like internal platform
- a future service for the B2B storefront

The next architectural milestone is **authentication + role-based access control**, and the recommended implementation is **Auth.js + Postgres users/roles + server-side permission checks**.
