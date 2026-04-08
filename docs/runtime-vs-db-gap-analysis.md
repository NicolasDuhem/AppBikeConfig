# Runtime vs DB gap analysis (CSV truth)

Date: April 8, 2026.

## Major gaps

## 1) Baseline schema incompleteness

`sql/schema.sql` defines only a subset of tables seen in CSV truth.
Missing (in baseline SQL, present in real DB):
- `app_users`, `audit_log`
- `cpq_import_rows`, `cpq_import_row_translations`, `cpq_import_runs`
- `cpq_products`, `cpq_product_attributes`, `cpq_product_assets`
- `feature_flags`, `feature_flag_audit`
- `roles`, `user_roles`

## 2) Runtime write to table missing in DB truth

`/api/role-permissions` PATCH writes `role_permission_baselines_audit`, but CSV schema has no such table.

Implication: PATCH can fail in CSV-truth environments.

## 3) Legacy table still present

`sku_rules` exists in CSV truth and repo SQL history but has no runtime API usage.

## 4) Runtime-active truth anchors

The runtime is anchored on:
- CPQ canonical/config: `cpq_import_rows`, `cpq_import_row_translations`, `sku_digit_option_config`, `sku_generation_dependency_rules`
- CPQ persistence/matrix: `cpq_products`, `cpq_product_attributes`, `cpq_sku_rules`, `cpq_availability`, `cpq_countries`, `cpq_product_assets`
- RBAC/audit: `app_users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `user_permissions`, `audit_log`
- Feature flags: `feature_flags`, `feature_flag_audit`
