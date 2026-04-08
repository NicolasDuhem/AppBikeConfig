# Column cleanup candidates (CSV truth + runtime reconciliation)

Date: April 8, 2026 (cpq_import_runs + cpq_products wave).

## High-confidence candidates

## 1) `cpq_import_rows`
- `raw_option_name` (removed in migration `015_drop_cpq_import_rows_raw_columns.sql`)
- `raw_digit` (removed in migration `015_drop_cpq_import_rows_raw_columns.sql`)
- `raw_code_value` (removed in migration `015_drop_cpq_import_rows_raw_columns.sql`)

Reason: no runtime SQL references in app/lib.

## 2) `cpq_import_runs` (wave-based pruning)
- **Actively used now (direct runtime read/write evidence):**
  - reads: `file_name`, `selected_line`, `electric_type`, `is_special`, `special_edition_name`, `character_17`
  - writes: `current_phase`, `status`, `error_message`, `error_stack`, `completed_at`, `failed_at`
- **Likely removable after diagnostics redesign (no in-repo runtime references):**
  - `rows_read`, `rows_imported`, `rows_skipped`, `rows_deactivated`, `rows_inserted`
  - `uploaded_by`, `uploaded_at`, `started_at`, `is_dry_run`
- **Decision:** keep table and all columns for now; remove only in a dedicated retirement/pre-retirement run.

## 3) `cpq_products` (large denormalized legacy payload)
- **Must keep (direct runtime insert):**
  - `id`, `import_run_id`, `cpq_ruleset`, `brake_reverse`, `brake_non_reverse`, `sku_code`, `created_by`, `created_at`
- **Compatibility fallback columns (still used by `cpq_products_flat` coalesce projection):**
  - `product_assist`, `product_family`, `product_line`, `product_model`, `product_type`, `description`
  - `handlebar_type`, `speeds`, `mudguardsandrack`, `territory`, `mainframecolour`, `rearframecolour`, `frontcarrierblock`, `lighting`, `saddleheight`, `gearratio`
  - `saddle`, `tyre`, `brakes`, `pedals`, `saddlebag`, `suspension`, `biketype`, `toolkit`, `saddlelight`
  - `configcode`, `optionbox`, `framematerial`, `frameset`, `componentcolour`, `onbikeaccessories`
  - `handlebarstemcolour`, `handlebarpincolour`, `frontframecolour`, `frontforkcolour`
- **Removed in this wave (high-confidence dead placeholders):**
  - `position29`, `position30` (migration `016_cpq_products_drop_position_columns.sql`)
- **Next staged candidates:** only after reducing `cpq_products_flat` fallback dependency, then drop in small batches.

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
