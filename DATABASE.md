# DATABASE.md

## Purpose

Runtime-grounded schema inventory for AppBikeConfig. This document captures what is actively used vs compatibility vs deprecation-candidate behavior.

> Rule: every data behavior change must update both `DATABASE.md` and `PROCESSDATA.md`.

## 1) Object status inventory

| Object | Classification | Certainty | Notes |
|---|---|---|---|
| `app_users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `user_permissions` | Active | High | Auth + RBAC runtime.
| `audit_log` | Active | High | Primary write audit + deprecation telemetry sink.
| `feature_flags`, `feature_flag_audit` | Active | High | CPQ/legacy switch + flag administration.
| `cpq_import_rows` | Active (canonical) | High | SKU definition + CPQ option source + push reference rows.
| `cpq_product_attributes` | Active | High | Normalized option mapping from generated products.
| `cpq_products` | Active (with legacy payload columns) | High | CPQ product identity persists; many text columns compatibility-only.
| `cpq_products_flat` (view) | Active compatibility projection | High | CPQ matrix read joins rely on it.
| `cpq_sku_rules`, `cpq_countries`, `cpq_availability` | Active | High | CPQ matrix runtime core.
| `cpq_product_assets` | Active (feature-flagged writes) | High | Picture picker persistence.
| `sku_digit_option_config`, `sku_generation_dependency_rules` | Active | High | Product setup + generation validation.
| `role_permission_baselines_audit` | Active | High | Role baseline PATCH appends rows.
| `products`, `countries`, `availability` | Compatibility only | High | Legacy matrix + builder push when CPQ flag is off.
| `setup_options` | Compatibility only / partial | High | Legacy setup API still reachable.
| `sku_rules` | Partial / migration-era | Medium | Used by migrations/seed/backfill, not main runtime APIs.
| `cpq_import_runs` | Partial / migration-era | High | `/api/cpq/generate?run_id=` still reads/writes status.
| `cpq_import_row_translations` | Unused in repo | Medium | No runtime references found.

## 2) High-value column usage notes

### `cpq_import_rows`
- Actively used: `id`, `import_run_id`, `option_name`, `choice_value`, `digit_position`, `code_value`, `status`, `is_active`, `deactivated_at`, `deactivation_reason`, `updated_at`, `updated_by`, `source`, `action_attempted`.
- Diagnostics/legacy-oriented: `reason`, raw import columns.

### `cpq_products`
- Active runtime columns: `id`, `import_run_id`, `cpq_ruleset`, `brake_reverse`, `brake_non_reverse`, `sku_code`, `created_by`, `created_at`.
- Compatibility-only columns (current runtime mostly reads via `cpq_products_flat`): attribute text payload columns such as `product_assist`, `product_family`, `product_line`, `product_model`, `product_type`, `handlebar_type`, `speeds`, `mudguards_and_rack`, `main_frame_colour`, `rear_frame_colour`, `lighting`, `saddle_height`, `gear_ratio`, `tyre`, `brakes`, `pedals`, `saddlebag`, `suspension`, `toolkit`, `saddle_light`, `config_code`, `option_box`, `frame_material`, `frame_set`, `component_colour`, `on_bike_accessories`, `handlebar_stem_colour`, `handlebar_pin_colour`, `front_frame_colour`, `front_fork_colour`, plus legacy text columns like `description`, `position29`, `position30`.

### `cpq_import_runs`
- Runtime-relevant fields in GET diagnostic path: `id`, `selected_line`, `electric_type`, `is_special`, `special_edition_name`, `character_17`, `file_name`, `current_phase`, `status`, `error_message`, `error_stack`, `completed_at`, `failed_at`.

## 3) Critical constraints relied on by runtime

- `cpq_import_rows_active_structural_uniq` (active canonical uniqueness).
- `cpq_sku_rules_active_unique` (active matrix uniqueness by `sku_code + cpq_ruleset + brake_type`).
- `cpq_product_attributes (cpq_product_id, option_name)` unique upsert contract.
- `cpq_availability` composite primary key.
- RBAC FK integrity across users/roles/permissions tables.
- Domain checks for brake type / status fields in matrix tables.

## 4) Drift and uncertainty notes

- `cpq_import_runs` is still reachable for diagnostics but creation path appears external/retired in this repo.
- `cpq_import_row_translations` has no references in code; keep as medium-certainty until external dependency audit is complete.
- Legacy tables/routes remain reachable whenever `import_csv_cpq` is false.
- `/api/countries` is now telemetry-instrumented as a compatibility endpoint and should not be extended for new features.

## 5) Deprecation governance

- Canonical-first rule: new product functionality must use CPQ tables, not `products/countries/availability` or `setup_options`.
- Retirement gates and sequence: `docs/legacy-deprecation-plan.md`.

## 6) Generated inventory artifacts

- Human-readable heuristic scan: `docs/generated/db-usage-report.md`
- Machine-friendly scan output: `docs/database-runtime-inventory.json`
