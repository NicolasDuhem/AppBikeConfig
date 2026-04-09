# Database cleanup master plan (CSV truth reconciliation)

Date: **April 8, 2026** (final `cpq_import_runs` retirement).
Primary truth inputs: `database schema.csv` and `database constraints.csv`.

## 1) Reconciliation scope and method

This plan reconciles four layers:

1. **Real DB truth** from CSV snapshots (authoritative for this run).
2. **Runtime code** in `app/**` + `lib/**` (API/page/service/helper behavior).
3. **Repository SQL** (`sql/schema.sql` + migrations + seeds).
4. **Existing docs** (`DATABASE.md`, `PROCESSDATA.md`, `ARCHITECTURE.md`, inventory docs).

Evidence method:
- table usage: SQL statements found in runtime source files,
- column usage: column token appears in runtime SQL touching that table,
- constraints: classified by whether runtime behavior depends on data validity they enforce.

## 2) DB truth inventory (from CSV)

- **Tables:** 22
- **Columns:** 218
- **Constraint rows exported:** 214
  - CHECK: 135
  - PRIMARY KEY: 34 (includes duplicate rows for composite keys in export format)
  - FOREIGN KEY: 29
  - UNIQUE: 16

Main table families:
- RBAC/Auth/Audit: `app_users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `user_permissions`, `audit_log`
- CPQ canonical/config: `cpq_import_rows`, `cpq_import_row_translations`, `sku_digit_option_config`, `sku_generation_dependency_rules`
- CPQ persistence/matrix: `cpq_products`, `cpq_product_attributes`, `cpq_sku_rules`, `cpq_availability`, `cpq_countries`, `cpq_product_assets`
- Feature flags/ops: `feature_flags`, `feature_flag_audit`
- Legacy bridge: `sku_rules`

## 3) Critical repo SQL mismatches

## 3.1 `sql/schema.sql` is materially incomplete vs real DB

CSV tables missing in baseline schema SQL:
- `app_users`
- `audit_log`
- `cpq_import_row_translations`
- `cpq_import_rows`
- `cpq_product_assets`
- `cpq_product_attributes`
- `cpq_products`
- `feature_flag_audit`
- `feature_flags`
- `roles`
- `user_roles`

Impact: a new environment created from only `sql/schema.sql` cannot support runtime.

## 3.2 `role_permission_baselines_audit` reconciliation status

- Runtime writes to `role_permission_baselines_audit` in `/api/role-permissions` PATCH.
- This run makes that table explicit in supported truth via migration `sql/014_role_permission_baselines_audit_csv_truth.sql` and CSV-truth inventory updates.

Risk class: previously high; now mitigated by explicit schema support.

## 4) Table-level classification and cleanup posture

| Table | Classification | Runtime usage class | Risk | Action |
|---|---|---|---|---|
| `app_users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `user_permissions` | Active | Active runtime + admin | High if changed | Keep |
| `audit_log` | Active | Write-heavy audit + read metadata | High if removed | Keep |
| `feature_flags`, `feature_flag_audit` | Active | Active admin/config + bootstrap reads | Medium | Keep |
| `cpq_import_rows` | Active (canonical) | Active runtime (read/write) | Very high | Keep |
| `cpq_import_row_translations` | Active | Active runtime (read/write) | High | Keep |
| `sku_digit_option_config`, `sku_generation_dependency_rules` | Active (config) | Active admin/config | High | Keep |
| `cpq_products`, `cpq_product_attributes` | Active / partially normalized | Active write path; many legacy columns still present | Medium | Keep table, clean columns |
| `cpq_sku_rules`, `cpq_availability`, `cpq_countries` | Active | Active matrix runtime | Very high | Keep |
| `cpq_product_assets` | Active (feature-flag path) | Active write when enabled | Medium | Keep |
| `sku_rules` | Cleanup candidate (legacy) | Not used by runtime; seed/migration bridge only | Medium-high external dependency risk | Replace/remove in staged migration |

## 5) Column-level reconciliation (high value cleanup list)

## 5.1 High-confidence removal candidates (not referenced by runtime SQL)

### `cpq_import_rows`
- `raw_option_name`, `raw_digit`, `raw_code_value` (removed in migration `sql/015_drop_cpq_import_rows_raw_columns.sql`; rollback is additive restore SQL in-file)
- Rationale: no runtime reads/writes in API logic; likely import-diagnostics residue.

### `cpq_import_runs` (retired in this run)
- Runtime dependency removed from `/api/cpq/generate` GET (no `run_id`; no lifecycle writes).
- Table dropped in migration `sql/020_remove_cpq_import_runs.sql` after dependent FKs were removed from `cpq_import_rows.import_run_id` and `cpq_products.import_run_id`.
- `import_run_id` columns are intentionally retained nullable/no-FK as staged compatibility residue.

### `cpq_products` (column-level verdict)
- **Must keep (direct runtime write/read):** `id`, `cpq_ruleset`, `sku_code`, `created_by`, `created_at` (with `import_run_id` retained only as staged compatibility residue).
- **Dropped in this wave (safe micro-batch):** `brake_reverse`, `brake_non_reverse` via migration `017_cpq_products_drop_brake_columns.sql`.
  - Evidence: no `cpq_products_flat` dependency, no in-repo runtime reads, push write-path migrated to avoid inserting these columns.
- **Dropped in this wave (paired fallback reduction + drop):** `product_assist`, `product_family`, `product_line`, `product_model`, `product_type` via migration `018_cpq_products_flat_remove_identity_fallback.sql`.
  - Evidence: `cpq_products_flat` now projects these fields directly from normalized attributes (`max(choice_value)` on `cpq_product_attributes`/`cpq_import_rows`) with no `p.legacy_column` fallback, and runtime reads target `cpq_products_flat` rather than raw `cpq_products` columns.
- **Dropped in this wave (final fallback-coupled subset):** `handlebar_type`, `speeds`, `mudguardsandrack`, `territory`, `mainframecolour`, `rearframecolour`, `frontcarrierblock`, `lighting`, `saddleheight`, `gearratio`, `saddle`, `tyre`, `brakes`, `pedals`, `saddlebag`, `suspension`, `biketype`, `toolkit`, `saddlelight`, `configcode`, `optionbox`, `framematerial`, `frameset`, `componentcolour`, `onbikeaccessories`, `handlebarstemcolour`, `handlebarpincolour`, `frontframecolour`, `frontforkcolour` via migration `019_cpq_products_flat_remove_remaining_fallback.sql`.
  - Evidence: `cpq_products_flat` now projects these fields from normalized attributes only (`max(choice_value)`), and runtime reads consume the view projection.
- **Compatibility residue left intentionally:** `description` (not projected via fallback; track as a small separate cleanup candidate).
- **Removed in prior wave (no runtime/migration/view dependency):** `position29`, `position30` via migration `016_cpq_products_drop_position_columns.sql`.
- **Decision:** continue with dedicated column-drop batches only after each candidate is proven absent from runtime SQL and compatibility projection requirements.

### Other low-risk metadata columns to review
- `cpq_countries.created_at`, `cpq_countries.updated_at`
- `cpq_import_row_translations.created_at`
- `cpq_product_attributes.created_at`
- `sku_digit_option_config.created_at`
- `sku_generation_dependency_rules.created_at`
- `feature_flag_audit.updated_at`

## 5.2 Explicitly keep (runtime-critical columns)

- `cpq_import_rows`: `id`, `option_name`, `choice_value`, `digit_position`, `code_value`, `status`, `is_active`, `updated_by`, `updated_at`
- `cpq_sku_rules`: `id`, `sku_code`, `cpq_ruleset`, `brake_type`, `bc_status`, `is_active`
- `cpq_availability`: `cpq_sku_rule_id`, `cpq_country_id`, `available`
- `cpq_countries`: `id`, `country`, `region`, `brake_type`, `locale_code`
- `cpq_import_row_translations`: `cpq_import_row_id`, `locale`, `translated_value`, `updated_by`

## 6) Constraint-level classification

## 6.1 Required / safety-critical (keep)

- FK chain supporting CPQ matrix integrity:
  - `cpq_availability -> cpq_sku_rules/cpq_countries`
  - `cpq_product_attributes -> cpq_products/cpq_import_rows`
  - `cpq_import_row_translations -> cpq_import_rows`
- Domain checks:
  - `cpq_countries.brake_type`
  - `cpq_sku_rules.brake_type`
  - `cpq_sku_rules.bc_status`
  - `cpq_import_rows.status`
  - `sku_digit_option_config.selection_mode` + digit range
  - `sku_generation_dependency_rules.rule_type` + digit ranges
- Uniques enforcing business semantics:
  - active `cpq_sku_rules` uniqueness
  - row+locale uniqueness on translations
  - `(cpq_product_id, option_name)` uniqueness

## 6.2 Legacy-only / cleanup candidates

- All constraints on `sku_rules` after dependency verification window.
- Potentially redundant NOT NULL-exported CHECK rows for columns that are operationally optional in transitional flows (validate before drop).

## 7) Known legacy focus verdicts

## 7.1 `sku_rules` verdict

**Decision: replace then remove (next staged target), not immediate hard-drop.**

Reasoning:
- No runtime API path queries `sku_rules`.
- It remains in seed/migration history and may still be referenced by out-of-band scripts/environments.
- Safe staged plan is feasible and lower risk than indefinite retention.

## 7.2 Setup/config tables

- `sku_digit_option_config` and `sku_generation_dependency_rules` are actively used and must remain.
- Cleanup should be column-level only (e.g., low-value timestamps), not table removal.

## 7.3 CPQ tables

- CPQ core is actively used; table removal is out-of-scope.
- Highest remaining value cleanup is staged `import_run_id` residue cleanup once compatibility risk window closes.

## 7.4 Translation + locale/country

- `cpq_import_row_translations` and `cpq_countries` are active and coupled by locale-management logic.
- Constraints in this area are safety-critical and should stay.

## 8) Staged cleanup sequence with rollback

## Stage A (already completed)

1. keep/support `role_permission_baselines_audit` as a real DB object.
2. drop `cpq_import_rows.raw_*` columns with rollback SQL posture.
3. drop `cpq_products.position29` and `cpq_products.position30` as dead placeholders.

Rollback:
- role baseline audit table is additive/non-breaking and can remain on rollback.
- raw column rollback uses additive `alter table ... add column` statements documented in `sql/015_drop_cpq_import_rows_raw_columns.sql`.
- `cpq_products` placeholder rollback uses additive `alter table ... add column` statements documented in `sql/016_cpq_products_drop_position_columns.sql`.

## Stage B (column cleanup wave 1)

1. Completed: dedicated `cpq_products` micro-batch dropping `brake_reverse` + `brake_non_reverse` (2 columns) with additive rollback posture.
2. Completed: run-context ownership replacement in `/api/cpq/generate` GET removed the final destructive-cleanup blocker for `cpq_import_runs`.

Rollback: re-add columns nullable with defaults; no data-critical semantics expected.

## Stage C (column cleanup wave 2)

1. Completed in migration `019`: final `cpq_products` fallback-coupled payload reduction (`coalesce(..., p.column)` compatibility fields removed from view + matched column drops).
2. Completed in migration `020`: final `cpq_import_runs` retirement (drop dependent FKs, then drop table) after replacing `/api/cpq/generate` GET run metadata/lifecycle ownership.

Rollback: use rollback block in migration `020` to recreate table + FKs.

## Stage D (`sku_rules` retirement)

1. Freeze seed/migration dependency on `sku_rules`.
2. Verify zero external usage window.
3. Drop `sku_rules` constraints/indexes/table.

Rollback: restore table from pre-drop backup or down migration.

## 9) Certainty map

- **High certainty:** table-level active vs legacy classification, core CPQ/RBAC dependencies.
- **Medium certainty:** some column-level unused candidates (string-token heuristic + no runtime references).
- **Lower certainty:** external dependencies outside repository runtime.

## 10) Immediate next action (non-vague)

**This run delivered final `cpq_import_runs` retirement:**
1. `/api/cpq/generate` GET no longer depends on `cpq_import_runs` or `run_id`.
2. Migration `020` removes FK coupling from `cpq_import_rows.import_run_id` and `cpq_products.import_run_id`, then drops `cpq_import_runs`.
3. Prior low-risk drops remain in place (`016` position placeholders, `017` brake compatibility columns, `018` product identity columns, `019` remaining fallback-coupled attributes).

Recommended next cleanup target: **one tiny follow-up for `import_run_id` column retirement (if desired)**, then `sku_rules` replacement/removal prep.
