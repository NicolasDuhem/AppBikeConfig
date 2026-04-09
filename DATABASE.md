# DATABASE.md

## Purpose

Operational database truth for AppBikeConfig, reconciled against:
- `database schema.csv` (**authoritative schema truth for this run**)
- `database constraints.csv` (**authoritative constraints truth for this run**)
- runtime SQL in `app/**` + `lib/**`
- repository SQL in `sql/**` (explicitly non-authoritative when conflicting)

Date reconciled: **April 9, 2026** (`import_run_id` residue cleanup + final `sku_rules` removal).

---

## 1) Real DB truth summary (CSV)

- 22 tables
- 218 columns
- 214 exported constraint rows
  - CHECK: 135
  - PRIMARY KEY: 34
  - FOREIGN KEY: 29
  - UNIQUE: 16

Table families:
- RBAC/Auth/Audit: `app_users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `role_permission_baselines_audit`, `user_permissions`, `audit_log`
- CPQ canonical/config: `cpq_import_rows`, `cpq_import_row_translations`, `sku_digit_option_config`, `sku_generation_dependency_rules`
- CPQ persistence/matrix: `cpq_products`, `cpq_product_attributes`, `cpq_sku_rules`, `cpq_availability`, `cpq_countries`, `cpq_product_assets`
- Feature/ops: `feature_flags`, `feature_flag_audit`

---

## 2) Runtime table classification

| Table(s) | Classification | Runtime mode | Decision |
|---|---|---|---|
| `app_users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `user_permissions` | Active | Auth + RBAC admin | Keep |
| `audit_log` | Active | Write/read audit | Keep |
| `feature_flags`, `feature_flag_audit` | Active admin/config | Flag control plane | Keep |
| `cpq_import_rows` | Active canonical | CPQ source of truth | Keep |
| `cpq_import_row_translations` | Active | Locale overlay | Keep |
| `sku_digit_option_config`, `sku_generation_dependency_rules` | Active admin/config | Setup control plane | Keep |
| `cpq_products`, `cpq_product_attributes` | Active + partially legacy payload | Push + normalized link | Keep table, prune columns |
| `cpq_sku_rules`, `cpq_availability`, `cpq_countries` | Active | Matrix persistence | Keep |
| `cpq_product_assets` | Active (feature-flag path) | Optional picture flow | Keep |

---

## 3) Column-level reconciliation highlights

## 3.1 Actively used core columns (examples)

- `cpq_import_rows`: `option_name`, `choice_value`, `digit_position`, `code_value`, `status`, `is_active`, `updated_by`, `updated_at`
- `cpq_import_row_translations`: `cpq_import_row_id`, `locale`, `translated_value`, `updated_by`
- `cpq_sku_rules`: `sku_code`, `cpq_ruleset`, `brake_type`, `bc_status`, `is_active`
- `cpq_availability`: `cpq_sku_rule_id`, `cpq_country_id`, `available`
- `cpq_countries`: `country`, `region`, `brake_type`, `locale_code`

## 3.2 High-confidence cleanup candidates

- `cpq_import_rows.raw_option_name`, `cpq_import_rows.raw_digit`, `cpq_import_rows.raw_code_value` (**removed in prior wave via migration 015; rollback SQL included in-file**)
- `cpq_products.product_assist`, `cpq_products.product_family`, `cpq_products.product_line`, `cpq_products.product_model`, `cpq_products.product_type` (**removed in this run via migration 018 after cpq_products_flat fallback reduction; rollback SQL included in-file**)
- `cpq_products.brake_reverse`, `cpq_products.brake_non_reverse` (**removed in prior wave via migration 017; rollback SQL included in-file**)
- `cpq_products.position29`, `cpq_products.position30` (**removed in prior run via migration 016; rollback SQL included in-file**)
- `cpq_products.handlebar_type`, `speeds`, `mudguardsandrack`, `territory`, `mainframecolour`, `rearframecolour`, `frontcarrierblock`, `lighting`, `saddleheight`, `gearratio`, `saddle`, `tyre`, `brakes`, `pedals`, `saddlebag`, `suspension`, `biketype`, `toolkit`, `saddlelight`, `configcode`, `optionbox`, `framematerial`, `frameset`, `componentcolour`, `onbikeaccessories`, `handlebarstemcolour`, `handlebarpincolour`, `frontframecolour`, `frontforkcolour` (**removed in this run via migration 019 after cpq_products_flat fallback reduction; rollback SQL included in-file**).
- Compatibility residue left in `cpq_products`: `description` (kept intentionally for a separate evidence-backed micro-batch).
- `cpq_import_rows.import_run_id` and `cpq_products.import_run_id` were dropped in migration `021_drop_import_run_id_residue.sql` (post-`cpq_import_runs` retirement).

See full staged list in `docs/column-cleanup-candidates.md`.

---

## 4) Constraint classification

## Required / safety-critical

- CPQ FK chain: availability, product-attributes, translations.
- Domain checks: `brake_type`, `bc_status`, import row `status`, setup rule checks.
- Business unique constraints: active CPQ SKU uniqueness, row+locale translation uniqueness.

## Cleanup candidates

- Legacy `sku_rules` constraints/indexes/table are retired in migration `023_drop_legacy_sku_rules.sql`.
- Potentially redundant NOT NULL check-export entries after explicit validation.

See `docs/constraint-cleanup-candidates.md`.

---

## 5) Real DB vs repository SQL mismatch (critical)

`sql/schema.sql` is incomplete versus CSV-truth DB.

Tables present in CSV but missing from baseline schema SQL:
- `app_users`, `audit_log`, `cpq_import_rows`, `cpq_import_row_translations`, `cpq_products`, `cpq_product_attributes`, `cpq_product_assets`, `feature_flags`, `feature_flag_audit`, `roles`, `user_roles`.

`role_permission_baselines_audit` is now part of supported DB truth, aligned across runtime, migrations, and CSV inventories.

Interpretation:
- repo SQL cannot be considered current environment bootstrap truth,
- migration sequencing must explicitly resolve this divergence before further destructive cleanup.

---

## 6) `sku_rules` decision

Verdict: **Retired in this run (runtime-safe).**

- Runtime does not depend on `sku_rules`.
- Current setup/bootstrap seed flow does not depend on `sku_rules`.
- `sku_rules` now remains only in historical migration SQL and historical docs.


## 7) Migration decision and deployment/rollback posture

Decision implemented in this run:
1. Remove `/api/cpq/generate` GET dependency on `cpq_import_runs` and `run_id`-driven lifecycle writes; GET now validates generation context from query params and reads active canonical rows directly from `cpq_import_rows`.
2. Remove FK coupling from `cpq_import_rows.import_run_id` and `cpq_products.import_run_id`, then drop `cpq_import_runs` in migration `020_remove_cpq_import_runs.sql`.
3. Drop staged residue columns `cpq_import_rows.import_run_id` + `cpq_products.import_run_id` in migration `021_drop_import_run_id_residue.sql`.
4. Add bootstrap prep migration `022_prepare_sku_rules_retirement_bootstrap.sql` to source `sku_digit_option_config` from active canonical `cpq_import_rows` rows.
5. Drop retired legacy table/indexes/constraints in migration `023_drop_legacy_sku_rules.sql`.

Deployment sequencing:
1. Apply migration `020_remove_cpq_import_runs.sql` (drop FKs, then drop table).
2. Apply migration `021_drop_import_run_id_residue.sql` (drop compatibility residue columns).
3. Apply migration `022_prepare_sku_rules_retirement_bootstrap.sql` (bootstrap/config sync from canonical rows).
4. Deploy API code update for `/api/cpq/push` + `/api/sku-rules` insert payloads without `import_run_id`.
5. Apply migration `023_drop_legacy_sku_rules.sql` (drop legacy `sku_rules` + table-only indexes/constraints).

Rollback:
- For migration `020`: use the rollback block inside `020_remove_cpq_import_runs.sql` to recreate `cpq_import_runs` and restore both foreign keys.
- For migration `021`: use the rollback block inside `021_drop_import_run_id_residue.sql` to re-add `import_run_id` columns (nullable) plus index.
- For migration `022`: no destructive data change; rollback is reverting the prep migration and restoring previous bootstrap derivation flow if needed.
- GET behavior can be reverted by restoring prior route implementation if legacy `run_id` flow must be re-enabled.
- For migration `023`: use the rollback block inside `023_drop_legacy_sku_rules.sql` to recreate `sku_rules` and its legacy indexes/constraint if rollback is required.
