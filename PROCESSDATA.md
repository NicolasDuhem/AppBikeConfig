# PROCESSDATA.md

## Purpose

Detailed operational process/data map for AppBikeConfig CPQ runtime, reconciled with CSV database truth.

Date reconciled: **April 9, 2026** (`import_run_id` residue cleanup + `sku_rules` retirement prep).

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
- Active flow reads canonical/config tables only.
- GET now requires generation context from query params (`selected_line`, `electric_type`) and accepts optional context params (`is_special`, `special_edition_name`, `character_17`, `file_name`).
- GET reads active canonical rows directly from `cpq_import_rows` and no longer reads/writes `cpq_import_runs` lifecycle metadata or requires `run_id`.

## 2.6 Push + matrix operations

- `/api/cpq/push` writes `cpq_products`, `cpq_product_attributes`, `cpq_sku_rules`, `cpq_availability`.
- In this wave, `cpq_products_flat` no longer falls back to raw `cpq_products` payload columns for the remaining compatibility subset (`HandlebarType` through `FrontForkColour`); these projected values now resolve from normalized attributes only.
- Prior wave behavior remains: push row creation no longer writes `cpq_products.brake_reverse` / `cpq_products.brake_non_reverse`; brake semantics remain represented via `cpq_product_attributes` (`BrakeReverse` / `BrakeNonReverse`) and `cpq_sku_rules.brake_type`.
- `/api/cpq-matrix*` reads/writes matrix tables + availability + countries; optional assets flow reads/writes `cpq_product_assets`.
- Matrix integrity depends on FK + domain checks in CPQ tables.

---

## 3) Legacy vs active runtime distinction

- `sku_rules` exists physically but is not queried by runtime APIs.
- It now appears only in migration/seed history plus legacy bootstrap residue.
- Runtime canonical truth is `cpq_import_rows`.

---

## 4) Cleanup readiness from process perspective

## Safe now
- Column cleanup in non-critical residue fields (`cpq_import_rows.raw_*`) is complete via explicit drop migration from prior wave.
- Remaining fallback-coupled `cpq_products` columns were removed in this wave after detaching `cpq_products_flat` fallback for those fields (`handlebar_type`, `speeds`, `mudguardsandrack`, `territory`, `mainframecolour`, `rearframecolour`, `frontcarrierblock`, `lighting`, `saddleheight`, `gearratio`, `saddle`, `tyre`, `brakes`, `pedals`, `saddlebag`, `suspension`, `biketype`, `toolkit`, `saddlelight`, `configcode`, `optionbox`, `framematerial`, `frameset`, `componentcolour`, `onbikeaccessories`, `handlebarstemcolour`, `handlebarpincolour`, `frontframecolour`, `frontforkcolour`).
- Prior wave removals remain: product identity columns in migration `018`, brake columns in migration `017`, position placeholders in migration `016`.
- Compatibility residue intentionally left: `cpq_products.description` (separate follow-up candidate).
- Documentation and baseline inventory alignment.

## Needs staged verification
- `cpq_products` remaining denormalized payload column pruning (small dependency-checked batches).
- `cpq_import_runs` has been retired and dropped in migration `020`; no runtime API table dependency remains.
- Staged residue columns `cpq_import_rows.import_run_id` + `cpq_products.import_run_id` were removed in migration `021`.
- Full `sku_rules` retirement.

## Resolved in this run
- Completed final `cpq_products` fallback-coupled cleanup wave by removing `cpq_products_flat` fallback for the remaining compatibility subset and dropping the matched legacy columns in migration `019`.
- Removed `cpq_import_runs` dependency entirely from `/api/cpq/generate` GET and dropped FK coupling from `cpq_import_rows.import_run_id` + `cpq_products.import_run_id`.

---

## 5) Next operationally-safe action

This run shipped the final `cpq_import_runs` removal change set:
1. `/api/cpq/generate` GET moved to query-param generation context and canonical-row reads (no `run_id`, no lifecycle writes).
2. Migration `020_remove_cpq_import_runs.sql` removed FK coupling on `cpq_import_rows.import_run_id` + `cpq_products.import_run_id`, then dropped `cpq_import_runs`.
3. Migration `021_drop_import_run_id_residue.sql` removed staged residue columns `cpq_import_rows.import_run_id` + `cpq_products.import_run_id`.
4. Migration `022_prepare_sku_rules_retirement_bootstrap.sql` now derives `sku_digit_option_config` from canonical active `cpq_import_rows` rows (not legacy `sku_rules`).
