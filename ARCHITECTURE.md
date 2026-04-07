# AppBikeConfig Architecture

## 1) Architectural baseline

AppBikeConfig currently runs as a **dual-track architecture**:

1. **CPQ canonical track (primary direction):**
   - Canonical SKU definition rows in `cpq_import_rows`.
   - Normalized generated product attributes through `cpq_product_attributes`.
   - CPQ sales matrix in `cpq_sku_rules` + `cpq_availability` + `cpq_countries`.

2. **Legacy compatibility track (feature-flag fallback):**
   - Legacy matrix tables `products`, `countries`, `availability`.
   - Legacy builder endpoint `/api/builder-push`.

The runtime switch is primarily `feature_flags.import_csv_cpq` (public feature flag endpoint consumed by nav/pages).

---

## 2) Core domains and ownership

## 2.1 Identity and authorization
- Auth provider: credentials against `app_users`.
- RBAC model: `roles`, `user_roles`, `permissions`, `role_permissions`, `user_permissions`.
- Effective permission resolution merges role baseline + user overrides.
- Audit trail for operational writes stored in `audit_log`.

## 2.2 CPQ canonical data model

### Canonical definition source
- `cpq_import_rows` is the operational source for Product - SKU definition and Product - Create SKU option generation.
- Active lifecycle fields: `is_active`, `deactivated_at`, `deactivation_reason`, `updated_at`, `updated_by`, `source`.

### Normalized generated products
- `cpq_products` stores product identity (`id`, `sku_code`, run/ruleset context).
- `cpq_product_attributes` stores option references (`option_name` -> `cpq_import_row_id`).
- `cpq_products_flat` is a compatibility/read view that resolves attribute text values from normalized references (with fallback to old `cpq_products` text columns).

### Sales matrix (CPQ)
- `cpq_sku_rules` stores sellable rows scoped by `(sku_code, cpq_ruleset, brake_type)` and includes `bc_status`.
- `cpq_availability` stores country enablement.
- `cpq_countries` stores country + region + brake orientation.
- Optional media layer: `cpq_product_assets` (feature-flagged picture picker path).

## 2.3 Configuration domains
- `sku_digit_option_config`: required/multi-single behavior for each digit.
- `sku_generation_dependency_rules`: currently match-code dependency constraints between digits.

## 2.4 Feature management
- `feature_flags` runtime gating.
- `feature_flag_audit` change log.

---

## 3) Runtime process architecture

## 3.1 Product - SKU definition
- UI: `/sku-definition`
- API: `/api/sku-rules`
- Reads/writes canonical rows directly in `cpq_import_rows`.
- Delete protection checks `cpq_product_attributes` references.

## 3.2 Product - Setup
- UI: `/setup`
- API: `/api/product-setup`
- Maintains generation metadata tables (`sku_digit_option_config`, `sku_generation_dependency_rules`).

## 3.3 Product - Create SKU
- UI: `/cpq-feature`
- APIs:
  - `/api/cpq/options` (hydrate active canonical options)
  - `/api/cpq/generate` (compose combinations)
  - `/api/cpq/push` (persist generated rows to CPQ matrix path)

## 3.4 Sales - SKU vs Country
- UI: `/cpq-matrix` (when CPQ flag ON) or `/matrix` (legacy fallback).
- CPQ APIs under `/api/cpq-matrix/*` perform single save, batch save, bulk country toggle, BC status checks, and picture attachment.

## 3.5 Admin - Users / permissions baseline
- UI: `/users`
- APIs:
  - `/api/users`, `/api/roles`, `/api/permissions`
  - `/api/role-permissions` for standard role baseline management
- Baseline changes append `role_permission_baselines_audit`.

---

## 4) Constraints relied on by architecture

- Active canonical uniqueness on `cpq_import_rows` structural key.
- Active CPQ matrix uniqueness on `cpq_sku_rules` (`sku_code`, `cpq_ruleset`, `brake_type`).
- Composite PKs on availability tables for idempotent upsert.
- RBAC FKs for permission integrity.
- DB check constraints for brake types, bc status, digit bounds, dependency rule types.

---

## 5) Known compatibility/legacy surfaces

1. `products`/`countries`/`availability` legacy matrix tables remain active in fallback mode.
2. `sku_rules` remains legacy; canonical operational source is now `cpq_import_rows`.
3. `cpq_import_runs` remains partially active for run-scoped generation diagnostics.
4. `setup_options` route/table remains available but not central in current Product - Setup UX.
5. `cpq_import_row_translations` exists but currently has no runtime path.

---

## 6) Documentation governance (required)

From now on, every project change that affects data behavior must update:

- `DATABASE.md` → **data/schema knowledge** (tables, columns, constraints, status, cleanup candidates)
- `PROCESSDATA.md` → **process/data-flow knowledge** (trigger, reads, writes, field updates, validations, outputs)

This is mandatory for maintainability and safe deprecation planning.

