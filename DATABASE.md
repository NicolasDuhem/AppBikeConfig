# DATABASE.md

## Purpose

Runtime-grounded schema inventory for AppBikeConfig after CPQ-only runtime cutover.

This document distinguishes:
- active operational tables/views,
- compatibility/deprecation tables still present in schema,
- transitional/historical artifacts.

> Rule: every data behavior change must update both `DATABASE.md` and `PROCESSDATA.md`.

## 1) Runtime status inventory (CPQ-only runtime)

| Object | Classification | Certainty | Operational notes |
|---|---|---:|---|
| `app_users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `user_permissions` | Active | High | AuthN/AuthZ runtime and admin management baseline. |
| `audit_log` | Active | High | Authoritative audit stream for operational writes and compatibility telemetry. |
| `feature_flags`, `feature_flag_audit` | Active (partial runtime) | High | Feature-flag administration remains active; `import_csv_cpq` no longer controls runtime path selection. |
| `cpq_import_rows` | Active (canonical) | High | Canonical SKU-definition option source; generation input; delete guards and activation lifecycle. |
| `cpq_import_row_translations` | Active | High | Locale overlays for canonical options; runtime read by `/api/cpq/options`. |
| `cpq_products` | Active | High | Generated product identity and metadata persistence; source for flattened matrix view. |
| `cpq_product_attributes` | Active | High | Normalized per-product option-value store, upserted during CPQ push. |
| `cpq_products_flat` (view) | Active | High | Matrix read projection used for CPQ matrix table rendering. |
| `cpq_sku_rules`, `cpq_availability`, `cpq_countries` | Active | High | Core sales SKU-vs-country runtime model including brake-type constraints and locale-code mapping. |
| `cpq_product_assets` | Active (flag-scoped writes) | High | CPQ BDAM/picture metadata persistence when picture-picker feature flag permits writes. |
| `sku_digit_option_config`, `sku_generation_dependency_rules` | Active | High | Product Setup control plane for digit rules and generation dependency logic. |
| `role_permission_baselines_audit` | Active | High | Role-permission baseline mutation audit trail. |
| `cpq_import_runs` | Partial/transitional | High | Diagnostics/import-run status still referenced by `/api/cpq/generate?run_id=`; not a primary CPQ runtime path. |
| `products`, `countries`, `availability` | Compatibility/deprecation | High | Legacy model tables still present; no longer standard runtime model after CPQ-only cutover. |
| `setup_options` | Compatibility/deprecation | High | Legacy setup storage; superseded by CPQ setup tables in runtime model. |
| `sku_rules` | Transitional/historical | Medium | Legacy/migration support and backfill usage; not canonical runtime model. |

## 2) CPQ-active tables: column-level runtime usage

### 2.1 `cpq_import_rows` (canonical option source)

High-value active columns:
- identity/lifecycle: `id`, `status`, `is_active`, `deactivated_at`, `deactivation_reason`
- option identity: `option_name`, `choice_value`, `digit_position`, `code_value`
- provenance/ops: `import_run_id`, `source`, `action_attempted`, `updated_at`, `updated_by`

Operational role:
- powers SKU-definition UI,
- provides option sets to `/api/cpq/options`,
- participates in generation/push canonical mapping.

### 2.2 `cpq_import_row_translations` (locale overlays)

Active columns:
- keying: `cpq_import_row_id`, `locale`
- payload: `translated_value`
- audit/provenance: `created_at`, `created_by`, `updated_at`, `updated_by`

Operational role:
- optional locale-specific value replacement for `choice_value` only at runtime read time,
- never mutates canonical source rows,
- fallback to canonical value on missing/blank translation.

### 2.3 `cpq_products` + `cpq_product_attributes`

`cpq_products` runtime-critical columns:
- core: `id`, `sku_code`, `cpq_ruleset`, `import_run_id`, `created_at`, `created_by`
- brake semantics: `brake_reverse`, `brake_non_reverse`

`cpq_product_attributes` runtime-critical columns:
- `cpq_product_id`, `option_name`, `option_value`

Operational role:
- CPQ push persists product identity and normalized attribute set,
- matrix projection and filtering rely on these rows (via `cpq_products_flat` and joins).

### 2.4 `cpq_sku_rules` + `cpq_availability` + `cpq_countries`

`cpq_sku_rules`:
- rule identity and lifecycle: `id`, `cpq_product_id`, `sku_code`, `cpq_ruleset`, `is_active`
- operational controls: `brake_type`, `bc_status`, editable matrix fields

`cpq_availability`:
- key: (`cpq_rule_id`, `cpq_country_id`)
- payload: `available`

`cpq_countries`:
- country and region model
- `locale_code` used as runtime locale-default source for option translation resolution

Operational role:
- authoritative sales availability model for CPQ matrix runtime.

### 2.5 `sku_digit_option_config` + `sku_generation_dependency_rules`

Operational role:
- controls SKU generation option behavior, required flags, selection mode, ordering, and inter-option dependencies.

## 3) Feature-flag table semantics after cutover

### 3.1 `feature_flags`

- Still active for feature control infrastructure.
- `cpq_bdam_picture_picker` remains runtime-relevant.
- `import_csv_cpq` is retained for historical traceability and audit continuity but **is no longer a valid runtime routing or behavior switch**.

### 3.2 `feature_flag_audit`

- Remains required for governance and traceability of flag mutations.
- Historical records include prior `import_csv_cpq` toggles that explain earlier dual-track behavior.

## 4) Compatibility/deprecation schema area

### 4.1 Legacy matrix schema (`products`, `countries`, `availability`)

Status:
- retained for transitional safety and controlled retirement,
- no longer represents the operational runtime model.

Risk note:
- direct API consumers may still exist outside first-party UI;
- deprecation telemetry should be used to verify usage before deletion.

### 4.2 Legacy setup schema (`setup_options`)

Status:
- compatibility-only store.
- CPQ setup tables are canonical runtime source.

## 5) Runtime-critical constraints and invariants

The following constraints are relied upon by CPQ runtime correctness:

- `cpq_import_rows_active_structural_uniq`:
  prevents duplicate active canonical option rows by structural key.
- `cpq_sku_rules_active_unique`:
  enforces unique active matrix rows by `sku_code + cpq_ruleset + brake_type`.
- `cpq_product_attributes` uniqueness (`cpq_product_id`, `option_name`):
  supports idempotent upsert semantics during push.
- `cpq_availability` composite key:
  enforces unique per-rule per-country availability rows.
- RBAC foreign keys:
  preserve permission graph integrity.
- domain/check constraints on brake/status fields:
  preserve matrix behavior validity.

## 6) Historical/transitional objects to track

- `cpq_import_runs`: keep as diagnostics/transitional until confirmed obsolete.
- legacy tables (`products`, `countries`, `availability`, `setup_options`, some `sku_rules` usage): candidates for deeper Run 2 cleanup.

## 7) Operational classification summary

- **Active operational runtime:** CPQ tables/views and RBAC/audit core.
- **Active operational infrastructure:** feature-flag framework (excluding retired runtime-switch semantics).
- **Compatibility/deprecation:** legacy matrix/setup tables and associated APIs.
- **Historical/transitional:** import diagnostics and migration-era support structures.

## 8) Generated inventory artifacts

- Human-readable heuristic scan: `docs/generated/db-usage-report.md`
- Machine-friendly scan output: `docs/database-runtime-inventory.json`
- Supporting runtime inventory narrative: `docs/database-runtime-inventory.md`
