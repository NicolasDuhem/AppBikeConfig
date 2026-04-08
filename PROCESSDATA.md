# PROCESSDATA.md

## Purpose

Detailed operational process/data map for AppBikeConfig CPQ runtime, reconciled with CSV database truth.

Date reconciled: **April 8, 2026** (cpq_products_flat fallback-reduction wave: product identity subset).

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
- Transitional diagnostics still depend on `cpq_import_runs`:
  - GET reads full run row (`select *`) and consumes metadata fields (`file_name`, `selected_line`, `electric_type`, `is_special`, `special_edition_name`, `character_17`).
  - GET updates lifecycle fields (`current_phase`, `status`, `error_message`, `error_stack`, `completed_at`, `failed_at`).
- No runtime insert path currently exists in-repo for `cpq_import_runs`; treat this as transitional and keep until run-creation replacement is explicit.

## 2.6 Push + matrix operations

- `/api/cpq/push` writes `cpq_products`, `cpq_product_attributes`, `cpq_sku_rules`, `cpq_availability`.
- In this wave, `cpq_products_flat` no longer falls back to raw `cpq_products` columns for `ProductAssist`/`ProductFamily`/`ProductLine`/`ProductModel`/`ProductType`; these values now resolve from normalized attributes only.
- Prior wave behavior remains: push row creation no longer writes `cpq_products.brake_reverse` / `cpq_products.brake_non_reverse`; brake semantics remain represented via `cpq_product_attributes` (`BrakeReverse` / `BrakeNonReverse`) and `cpq_sku_rules.brake_type`.
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
- Column cleanup in non-critical residue fields (`cpq_import_rows.raw_*`) is complete via explicit drop migration from prior wave.
- `cpq_products.product_assist` + `product_family` + `product_line` + `product_model` + `product_type` were removed in this wave after detaching `cpq_products_flat` fallback for those fields.
- `cpq_products.brake_reverse` + `cpq_products.brake_non_reverse` were removed in the prior wave; no runtime read path or `cpq_products_flat` fallback depends on these columns.
- `cpq_products.position29` + `cpq_products.position30` were removed in the prior wave and remain absent.
- Documentation and baseline inventory alignment.

## Needs staged verification
- `cpq_products` remaining denormalized payload column pruning (small dependency-checked batches).
- `cpq_import_runs` deep cleanup, especially row counters and upload ownership fields that are not used by active runtime SQL.
- Full `sku_rules` retirement.

## Resolved in this run
- Staged `cpq_products` cleanup by removing `cpq_products_flat` fallback for `ProductAssist`/`ProductFamily`/`ProductLine`/`ProductModel`/`ProductType` and dropping the matched legacy columns in migration `018`.
- `cpq_import_runs` status clarified as transitional diagnostics table that is still read/write-touched by generation lifecycle handling.

---

## 5) Next operationally-safe action

This run shipped one paired fallback-reduction/drop change and one sequencing decision:
1. Remove `cpq_products_flat` fallback for `ProductAssist`/`ProductFamily`/`ProductLine`/`ProductModel`/`ProductType`, then drop matched `cpq_products` columns in migration `018_cpq_products_flat_remove_identity_fallback.sql`.
2. Keep `cpq_import_runs` intact for now, and target a dedicated retirement run after run-creation and diagnostics ownership are redesigned.
