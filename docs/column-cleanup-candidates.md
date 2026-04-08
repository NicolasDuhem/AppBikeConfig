# Column cleanup candidates (CSV truth + runtime reconciliation)

Date: April 8, 2026 (cpq_products_flat fallback-reduction wave: remaining compatibility subset).

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

### Decision matrix (column group + evidence + next action)

| Class | Columns | Evidence (runtime/view/docs) | Decision |
|---|---|---|---|
| Must keep now | `id`, `import_run_id`, `cpq_ruleset`, `sku_code`, `created_by`, `created_at` | `/api/cpq/push` writes identity row in `cpq_products`; `cpq_sku_rules.cpq_product_id` FK keeps row identity relevant. | Keep. |
| Safe next-drop candidate (executed now) | `brake_reverse`, `brake_non_reverse` | No `cpq_products_flat` projection dependency; no in-repo runtime reads; push path now persists brake semantics through `cpq_product_attributes` (`BrakeReverse` / `BrakeNonReverse`) and `cpq_sku_rules.brake_type`. | Dropped in migration `017_cpq_products_drop_brake_columns.sql` with additive rollback SQL in-file. |
| Safe next-drop candidate (executed now) | `product_assist`, `product_family`, `product_line`, `product_model`, `product_type` | View fallback removed in `cpq_products_flat` (attribute-only projection for ProductAssist/ProductFamily/ProductLine/ProductModel/ProductType); no in-repo runtime direct read/write dependency on raw `cpq_products` columns. | Dropped in migration `018_cpq_products_flat_remove_identity_fallback.sql` with additive rollback SQL in-file. |
| Compatibility-only legacy residue (not currently projected via `cpq_products_flat` fallback) | `description` | No direct runtime read from raw `cpq_products.description`; keep for now and handle in a separate evidence-backed micro-batch. | Keep for now. |
| Safe next-drop candidate (executed now) | `handlebar_type`, `speeds`, `mudguardsandrack`, `territory`, `mainframecolour`, `rearframecolour`, `frontcarrierblock`, `lighting`, `saddleheight`, `gearratio`, `saddle`, `tyre`, `brakes`, `pedals`, `saddlebag`, `suspension`, `biketype`, `toolkit`, `saddlelight`, `configcode`, `optionbox`, `framematerial`, `frameset`, `componentcolour`, `onbikeaccessories`, `handlebarstemcolour`, `handlebarpincolour`, `frontframecolour`, `frontforkcolour` | View fallback removed in `cpq_products_flat` (attribute-only projection for remaining compatibility subset); no in-repo runtime direct read/write dependency on raw `cpq_products` payload columns. | Dropped in migration `019_cpq_products_flat_remove_remaining_fallback.sql` with additive rollback SQL in-file. |
| Already removed in prior micro-batch | `position29`, `position30` | No runtime/view usage evidence. | Already dropped in `016_cpq_products_drop_position_columns.sql`. |

### Blockers and staged-later candidates

- **Primary blocker removed:** `cpq_products_flat` no longer depends on the remaining legacy `cpq_products` compatibility payload columns via `coalesce(..., p.legacy_column)` after migration `019`.
- **Compatibility residue still present:** `cpq_products.description` (not part of fallback projection; leave as a separate tiny follow-up).
- **Removed in this wave (final fallback-coupled subset):**
  - `handlebar_type`, `speeds`, `mudguardsandrack`, `territory`, `mainframecolour`, `rearframecolour`, `frontcarrierblock`, `lighting`, `saddleheight`, `gearratio`
  - `saddle`, `tyre`, `brakes`, `pedals`, `saddlebag`, `suspension`, `biketype`, `toolkit`, `saddlelight`
  - `configcode`, `optionbox`, `framematerial`, `frameset`, `componentcolour`, `onbikeaccessories`
  - `handlebarstemcolour`, `handlebarpincolour`, `frontframecolour`, `frontforkcolour`
  - migration: `019_cpq_products_flat_remove_remaining_fallback.sql`
- **Removed in prior waves:**
  - `product_assist`, `product_family`, `product_line`, `product_model`, `product_type` (migration `018_cpq_products_flat_remove_identity_fallback.sql`)
  - `brake_reverse`, `brake_non_reverse` (migration `017_cpq_products_drop_brake_columns.sql`)
  - `position29`, `position30` (migration `016_cpq_products_drop_position_columns.sql`)
- **Next staged candidate:** `cpq_products.description` only, if direct dependency check remains clear.

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
