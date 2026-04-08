# Column cleanup candidates (CSV truth + runtime reconciliation)

Date: April 8, 2026.

## High-confidence candidates

## 1) `cpq_import_rows`
- `raw_option_name` (removed in migration `015_drop_cpq_import_rows_raw_columns.sql`)
- `raw_digit` (removed in migration `015_drop_cpq_import_rows_raw_columns.sql`)
- `raw_code_value` (removed in migration `015_drop_cpq_import_rows_raw_columns.sql`)

Reason: no runtime SQL references in app/lib.

## 2) `cpq_import_runs` (wave-based pruning)
Examples of runtime-unused payload fields:
- `character_17`, `electric_type`, `selected_line`, `special_edition_name`
- `rows_read`, `rows_imported`, `rows_skipped`, `rows_deactivated`, `rows_inserted`

Reason: runtime uses only transitional diagnostics flow.

## 3) `cpq_products` (large denormalized legacy payload)
Examples:
- `biketype`, `brakes`, `componentcolour`, `configcode`, `framematerial`, `frameset`
- additional descriptive columns not referenced by runtime SQL

Reason: runtime behavior centers on normalized relation (`cpq_product_attributes`) + CPQ matrix rows.

## Medium-confidence candidates (validate first)

- `cpq_countries.created_at`, `cpq_countries.updated_at`
- `cpq_import_row_translations.created_at`
- `cpq_product_attributes.created_at`
- `sku_digit_option_config.created_at`
- `sku_generation_dependency_rules.created_at`
- `feature_flag_audit.updated_at`

## Do-not-remove columns

Keep runtime-critical keys and lifecycle fields in:
- `cpq_import_rows`, `cpq_import_row_translations`
- `cpq_sku_rules`, `cpq_availability`, `cpq_countries`
- RBAC/auth/audit tables
