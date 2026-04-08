# AppBikeConfig Architecture

## 1) Current runtime posture (CPQ-only)

As of **April 8, 2026**, the application operates on a **single CPQ runtime track**.

Canonical surfaces:
- Product definition: `/sku-definition` + `/api/sku-rules`.
- Translation management: `/api/sku-rule-translations`.
- Product setup: `/setup` + `/api/product-setup`.
- Generation/push: `/cpq-feature`, `/api/cpq/options`, `/api/cpq/generate`, `/api/cpq/push`.
- Sales matrix: `/cpq-matrix`, `/api/cpq-matrix/*`.
- Admin control plane: users/roles/permissions/feature flags APIs.

Retired dual-track behavior (legacy Matrix/Builder branch switching) is no longer runtime truth.

## 2) Route topology

### 2.1 Primary routes
- `/` -> redirect to `/cpq-matrix`.
- `/cpq-matrix` -> Sales SKU-vs-country operations.
- `/cpq-feature` -> generation UI.
- `/sku-definition` -> canonical option/activation lifecycle.
- `/setup` -> digit/dependency setup control plane.
- `/feature-flags`, `/users` -> admin surfaces.

### 2.2 Compatibility redirects (non-runtime branches)
- `/matrix` -> `/cpq-matrix`.
- `/bike-builder` -> `/cpq-feature`.
- `/order` -> `/cpq-matrix`.

These are continuity redirects only.

## 3) Dataflow architecture (canonical)

### 3.1 Authoring layer
- Canonical options live in `cpq_import_rows`.
- Locale overlays live in `cpq_import_row_translations`.
- Setup rules live in `sku_digit_option_config` + `sku_generation_dependency_rules`.

### 3.2 Generation layer
- `/api/cpq/options` hydrates option catalog with locale-aware labels.
- `/api/cpq/generate` POST generates in-memory combinations, validating required/single/match-code constraints.
- `/api/cpq/generate` GET with `run_id` remains transitional diagnostics over `cpq_import_runs`.

### 3.3 Persistence layer
- `/api/cpq/push` writes generated output into:
  - `cpq_products`,
  - `cpq_product_attributes`,
  - `cpq_sku_rules`,
  - `cpq_availability`.
- Optional canonical backfill rows can be inserted into `cpq_import_rows` for unresolved attributes.

### 3.4 Operations layer (Sales matrix)
- `/api/cpq-matrix` reads CPQ rules + flattened attributes + availability + country metadata (+ optional assets).
- `/api/cpq-matrix/save-all` and `/bulk-update` mutate rule data and availability.
- `/api/cpq-matrix/check-bc-status` persists BC verification states.
- `/api/cpq-matrix/picture` writes `cpq_product_assets` when feature flag is enabled.

## 4) Cross-cutting concerns

### 4.1 Auth and RBAC
- Credentials auth via `next-auth` with `app_users`.
- Effective permissions = role baselines + user overrides (`roles`, `role_permissions`, `user_roles`, `user_permissions`).
- API authorization enforced by `requireApiRole`/`requireApiLogin`.

### 4.2 Auditing
- Mutating CPQ/admin endpoints emit `audit_log` records through `lib/audit.ts`.
- Feature-flag changes also persist to `feature_flag_audit`.

### 4.3 Feature flags
- Runtime-relevant flag: `cpq_bdam_picture_picker`.
- `import_csv_cpq` remains historical metadata only and is not a runtime branch switch.

### 4.4 Locale model
- Managed locales derive from `cpq_countries.locale_code`.
- Runtime locale resolution is centralized in `lib/cpq-runtime-locale.ts` and used by CPQ option hydration.

## 5) Physical schema vs runtime architecture

### 5.1 Fresh schema snapshot truth
`database schema.csv` and `database constraints.csv` describe a CPQ-first schema set (21 objects), including `sku_rules` but excluding old `products/countries/availability/setup_options`.

### 5.2 Repo baseline gap
`sql/schema.sql` still carries legacy table definitions from pre-cutover eras.

Architectural implication:
- Runtime architecture is already CPQ-only.
- Baseline SQL cleanup is the remaining architecture/documentation debt.

## 6) Historical context (explicitly non-runtime)

Removed runtime APIs/services:
- `/api/matrix*`
- `/api/builder-push`
- `/api/countries`
- `/api/setup-options`
- legacy matrix service module

These should be treated as retired implementation history, not active architecture.

## 7) Architecture-level cleanup recommendation

Best next action is a **forward-baseline database cleanup run**:
1. remove legacy table definitions from baseline SQL and seeds,
2. keep `sku_rules` as staged-deprecation until external dependency watchlist is cleared,
3. then execute explicit `sku_rules` drop migration.

## 8) Documentation governance

When behavior or persistence changes, update together:
- `ARCHITECTURE.md` (runtime structure)
- `DATABASE.md` (schema truth + cleanup posture)
- `PROCESSDATA.md` (process-level operational behavior)
- `docs/database-cleanup-recommendations.md` (retirement sequencing)
