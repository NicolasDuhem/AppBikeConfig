# PROCESSDATA.md

## Purpose

Runtime process/data-flow source-of-truth for AppBikeConfig after CPQ-only runtime cutover.

This document describes:
- current operational process flows,
- data reads/writes per flow,
- compatibility paths retained only for deprecation sequencing.

> Rule: every data behavior change must update both `DATABASE.md` and `PROCESSDATA.md`.

## 1) Top-level runtime map (CPQ-only)

### 1.1 Supported runtime user journey

1. User authenticates.
2. User navigates CPQ surfaces:
   - Sales - SKU vs Country (`/cpq-matrix`)
   - Product - Create SKU (`/cpq-feature`)
   - Product - SKU definition (`/sku-definition`)
   - Product - Setup (`/setup`)
3. User generates/pushes CPQ products.
4. User manages CPQ matrix and availability.

### 1.2 Retired runtime model

The historical dual-track routing model (`import_csv_cpq` ON/OFF switching between legacy and CPQ flows) is retired.

Operationally:
- CPQ flow is default and only supported runtime behavior.
- Legacy UI pages are transition redirects, not equivalent runtime alternatives.

## 2) Authentication and authorization

- Trigger: login or protected API call.
- Entry points: `lib/auth.ts`, `lib/api-auth.ts`, `/api/auth/[...nextauth]`.
- Reads: `app_users`, `user_roles`, `roles`, `role_permissions`, `permissions`, `user_permissions`.
- Writes: none in direct auth path.
- Failure states: invalid credentials, inactive user, insufficient role/permission for endpoint.

## 3) Feature flag processes (post-cutover semantics)

### 3.1 Public flag context (`/api/feature-flags/public`)

- Reads: `feature_flags` (runtime-relevant flags only), auth-derived roles/permissions.
- Runtime effect:
  - provides CPQ picture-picker gate (`cpq_bdam_picture_picker`),
  - supplies roles/permissions for UI nav visibility.
- Explicitly not used for CPQ-vs-legacy path switching.

### 3.2 Admin flag mutation (`/api/feature-flags`)

- Writes: `feature_flags`, `feature_flag_audit`.
- Guardrails:
  - requires `feature_flags.manage`.
  - `import_csv_cpq` is treated as retired runtime switch and is no longer mutable for routing behavior.

## 4) SKU definition lifecycle (canonical CPQ)

- UI/API: `/sku-definition`, `/api/sku-rules`, `/api/sku-rule-translations`.
- Reads:
  - `cpq_import_rows` (canonical source),
  - `cpq_import_row_translations` (locale overlays),
  - `cpq_countries` (`locale_code` set of managed locales),
  - `cpq_product_attributes` (delete guard),
  - audit/user tables for attribution.
- Writes:
  - `cpq_import_rows`,
  - `cpq_import_row_translations`,
  - `audit_log`.

Behavior guarantees:
- duplicate structural rows rejected,
- delete blocked when active references exist,
- translation values optional and fallback to canonical `choice_value`.

## 5) Product setup lifecycle (canonical CPQ)

### 5.1 Active setup flow

- UI/API: `/setup`, `/api/product-setup`.
- Reads:
  - `sku_digit_option_config`,
  - `sku_generation_dependency_rules`,
  - active digit context from `cpq_import_rows`.
- Writes:
  - upsert `sku_digit_option_config`,
  - replace/upsert `sku_generation_dependency_rules`.

### 5.2 Legacy setup API status

- `/api/setup-options` remains compatibility-only.
- Not part of CPQ-only runtime standard flow.
- Emits deprecation telemetry for residual usage tracking.

## 6) CPQ generation flow

### 6.1 Option hydration (`/api/cpq/options`)

- Reads:
  - active `cpq_import_rows`,
  - setup tables,
  - optional `cpq_import_row_translations`,
  - `cpq_countries` for locale resolution.
- Locale resolution sequence:
  1. explicit `locale` query (if managed),
  2. country locale by `country_id`/`country`,
  3. managed default locale (or `en-US`).
- Output:
  - generation option groups,
  - localized choice labels where available.

### 6.2 Combination generation (`/api/cpq/generate` POST)

- Reads setup + selected options.
- Processing is in-memory.
- No persistent writes.

### 6.3 Import-run diagnostics (`/api/cpq/generate` GET with `run_id`)

- Reads/Writes: `cpq_import_runs` status/phase fields and read context from `cpq_import_rows`.
- Treated as diagnostics/transitional behavior.

## 7) CPQ push flow (`/api/cpq/push`)

- Inputs: generated rows + selected brake mode.
- Writes:
  - `cpq_products`,
  - `cpq_product_attributes`,
  - `cpq_sku_rules`,
  - `cpq_availability`,
  - optional canonical backfill rows in `cpq_import_rows` when required.
- Consistency controls:
  - request-level dedupe,
  - DB uniqueness enforcement,
  - duplicate handling/rollback behavior around active rule collisions.

## 8) CPQ matrix flow (Sales - SKU vs Country)

### 8.1 Read path (`/api/cpq-matrix`)

- Reads:
  - `cpq_sku_rules`,
  - `cpq_products_flat`,
  - `cpq_availability`,
  - `cpq_countries`,
  - optional `cpq_product_assets`.

### 8.2 Write/mutation paths

- `/api/cpq-matrix/save-all`:
  - updates CPQ matrix row values and availability state.
- `/api/cpq-matrix/bulk-update`:
  - mass country assignment/removal with brake-type compatibility checks.
- `/api/cpq-matrix/check-bc-status`:
  - validates SKU existence/status against BigCommerce and updates status fields.
- `/api/cpq-matrix/picture`:
  - writes `cpq_product_assets` metadata, gated by `cpq_bdam_picture_picker` behavior.

### 8.3 UX/runtime expectations

- This is the canonical and only supported Sales SKU-vs-country operational surface.
- Legacy matrix is no longer a standard runtime alternative.

## 9) Navigation and routing behavior after cutover

- `/` -> `/cpq-matrix`
- `/matrix` -> redirect to `/cpq-matrix`
- `/bike-builder` -> redirect to `/cpq-feature`
- CPQ pages no longer branch behavior using `import_csv_cpq`.

This removes route-level dual-path behavior while preserving safe transition entry for old bookmarks.

## 10) Compatibility/deprecation flows still present

The following may remain callable for transition safety but are not runtime-standard behavior:

- Legacy matrix APIs: `/api/matrix`, `/api/matrix/save-all`, `/api/matrix/bulk-update`, `/api/matrix/check-bc-status`
- Legacy builder API: `/api/builder-push`
- Legacy countries API: `/api/countries`
- Legacy setup API: `/api/setup-options`

All are compatibility/deprecation scope and should be treated as do-not-extend surfaces.

## 11) Observability and deprecation telemetry

- `deprecation.path_invoked` events continue to flow to `audit_log` for compatibility endpoints.
- Telemetry supports Run 2 deletion sequencing by identifying residual external usage.

## 12) Run 2 cleanup map

Expected deeper cleanup pass:
- delete compatibility legacy APIs once telemetry confirms no required consumers,
- remove legacy table dependencies and dead service code,
- retire deprecation telemetry scaffolding tied only to removed endpoints,
- finalize docs to move legacy objects from compatibility -> historical/removed.

## 13) Supporting artifacts

- Structured runtime flow map: `docs/process-impact-map.md`
- Legacy retirement sequencing context: `docs/legacy-deprecation-plan.md`
- DB runtime inventory companion: `docs/database-runtime-inventory.md`
