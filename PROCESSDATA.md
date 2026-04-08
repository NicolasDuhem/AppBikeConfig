# PROCESSDATA.md

## Purpose

Detailed operational process/data map for AppBikeConfig CPQ runtime, reconciled with CSV database truth.

Date reconciled: **April 8, 2026**.

---

## 1) End-to-end process (runtime)

1. Auth/RBAC context resolution.
2. Canonical option lifecycle (`/api/sku-rules` -> `cpq_import_rows`).
3. Translation overlay management (`/api/sku-rule-translations` -> `cpq_import_row_translations`).
4. Setup/control updates (`/api/product-setup` -> config/rule tables).
5. Builder option hydration (`/api/cpq/options`).
6. Combination generation (`/api/cpq/generate`).
7. Push to matrix persistence (`/api/cpq/push`).
8. Matrix read/update flows (`/api/cpq-matrix*`).
9. Optional picture metadata updates (`/api/cpq-matrix/picture`).

---

## 2) Process truth by area

## 2.1 Auth + RBAC

- Reads: `app_users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `user_permissions`
- Writes: user management + role-permission assignment flows
- `/api/role-permissions` PATCH writes `role_permission_baselines_audit` as an explicit supported audit sink for role baseline permission grants.

## 2.2 SKU definition and canonical source

- Endpoint: `/api/sku-rules`
- Canonical table: `cpq_import_rows`
- Write path includes lifecycle toggles (`is_active`, deactivation fields), conflict detection, and audit writes.
- Delete path guarded by references in `cpq_product_attributes`.

## 2.3 Translation management

- Endpoint: `/api/sku-rule-translations`
- Reads canonical rows + locale metadata from `cpq_countries`
- Writes `cpq_import_row_translations` per row/locale.
- Locale safety relies on managed locales derived from `cpq_countries.locale_code`.

## 2.4 Setup/config management

- Endpoint: `/api/product-setup`
- Reads/writes:
  - `sku_digit_option_config`
  - `sku_generation_dependency_rules`
- Validation enforced by digit-range and rule-type semantics.

## 2.5 Generation + diagnostics

- Endpoint: `/api/cpq/generate`
- Active flow reads canonical/config tables.
- Transitional diagnostics involve `cpq_import_runs`.
- `cpq_import_runs` has high column-level cleanup potential once diagnostics are redesigned.

## 2.6 Push + matrix operations

- `/api/cpq/push` writes `cpq_products`, `cpq_product_attributes`, `cpq_sku_rules`, `cpq_availability`.
- `/api/cpq-matrix*` reads/writes matrix tables + availability + countries; optional assets flow reads/writes `cpq_product_assets`.
- Matrix integrity depends on FK + domain checks in CPQ tables.

---

## 3) Legacy vs active runtime distinction

- `sku_rules` exists physically but is not queried by runtime APIs.
- It remains in migration/seed history as a legacy bridge.
- Runtime canonical truth is `cpq_import_rows`.

---

## 4) Cleanup readiness from process perspective

## Safe now
- Column cleanup in non-critical residue fields (`cpq_import_rows.raw_*`) is now complete via explicit drop migration.
- Documentation and baseline inventory alignment.

## Needs staged verification
- `cpq_products` large denormalized payload column pruning.
- `cpq_import_runs` deep cleanup.
- Full `sku_rules` retirement.

## Resolved in this run
- Reliable role-permissions PATCH process in CSV-truth environments by explicitly supporting `role_permission_baselines_audit` in migration + CSV truth artifacts.
- Canonical table cleanup by dropping `cpq_import_rows.raw_option_name`, `raw_digit`, `raw_code_value`.

---

## 5) Next operationally-safe action

This run shipped a migration wave with two changes:
1. `role_permission_baselines_audit` is now an explicit supported DB object in CSV truth and migrations.
2. `cpq_import_rows.raw_option_name`, `raw_digit`, `raw_code_value` are dropped from supported schema with an additive rollback path documented in migration SQL.
