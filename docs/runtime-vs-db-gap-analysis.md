# Runtime vs DB gap analysis (CSV truth)

Date: April 8, 2026 (dedicated cpq_products small-batch wave).

## Major gaps

## 1) Baseline schema incompleteness

`sql/schema.sql` defines only a subset of tables seen in CSV truth.
Missing (in baseline SQL, present in real DB):
- `app_users`, `audit_log`
- `cpq_import_rows`, `cpq_import_row_translations`, `cpq_import_runs`
- `cpq_products`, `cpq_product_attributes`, `cpq_product_assets`
- `feature_flags`, `feature_flag_audit`
- `roles`, `user_roles`

## 2) Runtime write gap status

`/api/role-permissions` PATCH writes `role_permission_baselines_audit`, and this is now reconciled as a supported object in migrations and CSV truth.

Implication: CSV-truth environments now have an explicit schema path for this write.

## 3) Legacy table still present

`sku_rules` exists in CSV truth and repo SQL history but has no runtime API usage.

## 4) Runtime-active truth anchors

The runtime is anchored on:
- CPQ canonical/config: `cpq_import_rows`, `cpq_import_row_translations`, `sku_digit_option_config`, `sku_generation_dependency_rules`
- CPQ persistence/matrix: `cpq_products`, `cpq_product_attributes`, `cpq_sku_rules`, `cpq_availability`, `cpq_countries`, `cpq_product_assets`
- RBAC/audit: `app_users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `user_permissions`, `audit_log`
- Feature flags: `feature_flags`, `feature_flag_audit`

## 5) Current wave decisions

- `cpq_import_runs` remains transitional-but-active: `/api/cpq/generate` GET still reads run metadata and writes lifecycle/error state.
- `cpq_products` cleanup advanced with a low-risk drop of `brake_reverse` and `brake_non_reverse` (migration `017`), based on no in-repo runtime read and no `cpq_products_flat` fallback dependency.
- Prior low-risk drop: `position29` and `position30` (migration `016`).
- Remaining `cpq_products` denormalized columns are still compatibility-backed through `cpq_products_flat` fallback projection and should be retired only in staged batches after fallback reduction for each target subset.
