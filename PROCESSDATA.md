# PROCESSDATA.md

## Purpose

Durable process/data-flow reference for **current CPQ-only runtime behavior**.

This document captures:
- active process entry points,
- read/write tables per process,
- validation and output behavior,
- translation and country-locale runtime logic,
- explicitly labeled historical context only where still relevant.

## 1) Runtime map

### 1.1 Active user journeys

1. Authenticate.
2. Maintain canonical options/translations in SKU definition.
3. Configure generation behavior in Product - Setup.
4. Generate combinations in Product - Create SKU.
5. Push selected rows to CPQ matrix tables.
6. Operate Sales - SKU vs Country matrix (single/bulk edits, BC checks, optional picture metadata).

### 1.2 Retired runtime behavior

The legacy Matrix / Product Legacy Builder branch model is retired.

- No runtime branch depends on `import_csv_cpq`.
- `/matrix`, `/bike-builder`, and `/order` are redirects only.
- Legacy APIs (`/api/matrix*`, `/api/builder-push`, `/api/countries`, `/api/setup-options`) were removed.

## 2) Authentication and authorization flow

- Entry points: `lib/auth.ts`, `lib/api-auth.ts`, `/api/auth/[...nextauth]`.
- Reads: `app_users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `user_permissions`.
- Writes: none in credential verification path.
- Validation/failure outputs:
  - invalid credentials/inactive user => auth failure,
  - missing permission/role => API 403/redirect behavior.

## 3) Feature-flag and permission context

### 3.1 `/api/feature-flags/public`
- Reads: `feature_flags` + effective user role/permission context.
- Output:
  - runtime flags used by client UX (`cpq_bdam_picture_picker`),
  - role/permission payload for nav/action visibility.

### 3.2 `/api/feature-flags`
- Writes: `feature_flags`, `feature_flag_audit`.
- Validation:
  - requires `feature_flags.manage`.
- Post-cutover rule:
  - `import_csv_cpq` is historical and not a runtime path switch.

## 4) SKU definition and translation lifecycle

### 4.1 Canonical option CRUD (`/api/sku-rules`)

Reads:
- `cpq_import_rows`
- `cpq_product_attributes` (delete guard)
- auth attribution tables as needed

Writes:
- `cpq_import_rows`
- `audit_log`

Validation:
- structural duplicate checks,
- active/inactive lifecycle constraints,
- deletion blocked when references remain.

Outputs:
- canonical option rows plus mutation status/errors.

### 4.2 Translation management (`/api/sku-rule-translations`)

Reads:
- `cpq_import_rows`
- `cpq_import_row_translations`
- `cpq_countries` (managed locale set support)

Writes:
- `cpq_import_row_translations`
- `audit_log`

Validation:
- translation keys must map to canonical rows,
- locale-target updates preserve canonical fallback behavior.

Outputs:
- translation rows and operation diagnostics.

## 5) Product setup lifecycle (`/api/product-setup`)

Reads:
- `sku_digit_option_config`
- `sku_generation_dependency_rules`
- active digit context from `cpq_import_rows`

Writes:
- upsert/replace behavior in `sku_digit_option_config`
- upsert/replace behavior in `sku_generation_dependency_rules`

Validation:
- editable constraints by permission (`setup.manage`),
- type/domain checks for digit positions and rule semantics.

Outputs:
- current setup state for UI hydration,
- save results/errors for admin mutation.

## 6) CPQ generation flow

### 6.1 Option hydration (`/api/cpq/options`)

Reads:
- active `cpq_import_rows`
- setup tables
- `cpq_import_row_translations` (optional overlay)
- `cpq_countries` (locale resolution)

Locale resolution order:
1. explicit `locale` query (if managed),
2. locale from country context (`country_id` or `country` -> `cpq_countries.locale_code`),
3. managed default locale (fallback `en-US`).

Output:
- grouped generation options with translated labels where available.

### 6.2 Combination generation (`/api/cpq/generate` POST)

Reads:
- request-selected choices,
- setup constraints from `sku_digit_option_config` and `sku_generation_dependency_rules`.

Writes:
- none (in-memory generation).

Validation:
- required digit coverage,
- single/multi selection mode compliance,
- dependency-rule compatibility.

Output:
- generated combination rows or validation errors.

### 6.3 Import-run diagnostics (`/api/cpq/generate` GET)

Reads/Writes:
- `cpq_import_runs` phase/status updates,
- scoped reads from `cpq_import_rows`.

Role:
- transitional diagnostics/observability path (not primary user journey).

## 7) CPQ push flow (`/api/cpq/push`)

Inputs:
- generated rows + selected brake mode/scope.

Writes:
- `cpq_products`
- `cpq_product_attributes`
- `cpq_sku_rules`
- `cpq_availability`
- optional canonical support writes to `cpq_import_rows`
- `audit_log`

Validation/consistency:
- request-level dedupe,
- active-rule uniqueness enforcement,
- duplicate SKU handling and row-level skip/failure reporting.

Outputs:
- push summary with succeeded/skipped/failed diagnostics.

## 8) CPQ matrix lifecycle (`/api/cpq-matrix*`)

### 8.1 Read (`/api/cpq-matrix`)

Reads:
- `cpq_sku_rules`
- `cpq_products_flat`
- `cpq_availability`
- `cpq_countries`
- optional `cpq_product_assets`

Output:
- matrix rows, country metadata, and row-country availability map.

### 8.2 Mutations

- `/api/cpq-matrix/save-all`: row edits + availability updates.
- `/api/cpq-matrix/bulk-update`: country assignment/removal across selected rows.
- `/api/cpq-matrix/check-bc-status`: BigCommerce SKU verification + status persistence.
- `/api/cpq-matrix/picture`: picture metadata writes to `cpq_product_assets` (flag-gated).

Validation highlights:
- permission-specific write guards,
- brake-type compatibility checks before assigning countries,
- external BC check error handling with partial-success style responses.

## 9) Historical context (explicitly non-runtime)

Removed from runtime code in this repo:
- `/api/matrix*`
- `/api/builder-push`
- `/api/countries`
- `/api/setup-options`
- legacy matrix service/helper code

Legacy DB tables remain physically present in migrations/schema but are no longer read/written by active runtime paths.

## 10) Supporting artifacts

- `docs/process-impact-map.md`
- `docs/database-runtime-inventory.md`
- `docs/generated/db-usage-report.md`
