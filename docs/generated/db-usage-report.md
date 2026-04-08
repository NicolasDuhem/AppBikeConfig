# Generated DB usage report

Generated at: 2026-04-08T06:47:30.699Z

> Heuristic scan of SQL table/view names found in app/lib/sql source files. Manual docs remain authoritative.

| Object | File references |
|---|---|
| `app_users` | `app/api/sku-rules/route.ts`<br>`app/api/users/route.ts`<br>`lib/auth.ts`<br>`lib/feature-flags.ts`<br>`sql/002_auth_rbac.sql` |
| `audit_log` | `app/api/sku-rules/route.ts` |
| `availability` | `app/api/matrix/route.ts` |
| `countries` | `app/api/builder-push/route.ts`<br>`app/api/countries/route.ts`<br>`app/api/matrix/route.ts`<br>`lib/matrix-service.ts`<br>`sql/006_cpq_matrix_tables.sql`<br>`sql/seed.sql` |
| `cpq_availability` | `app/api/cpq-matrix/route.ts` |
| `cpq_countries` | `app/api/cpq-matrix/bulk-update/route.ts`<br>`app/api/cpq-matrix/route.ts`<br>`app/api/cpq/push/route.ts`<br>`lib/cpq-matrix-service.ts` |
| `cpq_import_rows` | `app/api/cpq/generate/route.ts`<br>`app/api/cpq/options/route.ts`<br>`app/api/cpq/push/route.ts`<br>`app/api/product-setup/route.ts`<br>`app/api/sku-rules/route.ts`<br>`sql/010_cpq_normalized_attributes_and_translations.sql`<br>`sql/013_cpq_import_rows_canonical_and_role_baseline.sql` |
| `cpq_import_runs` | `app/api/cpq/generate/route.ts` |
| `cpq_product_assets` | `app/api/cpq-matrix/picture/route.ts`<br>`app/api/cpq-matrix/route.ts` |
| `cpq_product_attributes` | `app/api/sku-rules/route.ts`<br>`sql/010_cpq_normalized_attributes_and_translations.sql` |
| `cpq_products` | `app/api/cpq/push/route.ts`<br>`sql/010_cpq_normalized_attributes_and_translations.sql` |
| `cpq_products_flat` | `app/api/cpq-matrix/route.ts` |
| `cpq_sku_rules` | `app/api/cpq-matrix/bulk-update/route.ts`<br>`app/api/cpq-matrix/picture/route.ts`<br>`app/api/cpq-matrix/route.ts`<br>`app/api/cpq/push/route.ts`<br>`lib/cpq-matrix-service.ts` |
| `feature_flags` | `app/api/feature-flags/route.ts`<br>`lib/feature-flags.ts` |
| `permissions` | `app/api/permissions/route.ts`<br>`app/api/role-permissions/route.ts`<br>`app/api/users/route.ts`<br>`lib/auth.ts`<br>`sql/012_permissions_and_sku_generation_config.sql`<br>`sql/seed.sql` |
| `products` | `app/api/matrix/bulk-update/route.ts`<br>`app/api/matrix/route.ts`<br>`lib/matrix-service.ts`<br>`sql/seed.sql` |
| `role_permissions` | `app/api/role-permissions/route.ts`<br>`lib/auth.ts` |
| `roles` | `app/api/role-permissions/route.ts`<br>`app/api/roles/route.ts`<br>`app/api/users/route.ts`<br>`lib/auth.ts`<br>`sql/002_auth_rbac.sql` |
| `setup_options` | `app/api/setup-options/route.ts` |
| `sku_digit_option_config` | `app/api/cpq/generate/route.ts`<br>`app/api/cpq/options/route.ts`<br>`app/api/product-setup/route.ts` |
| `sku_generation_dependency_rules` | `app/api/cpq/generate/route.ts`<br>`app/api/cpq/options/route.ts`<br>`app/api/product-setup/route.ts` |
| `sku_rules` | `sql/003_sku_rule_activation_and_constraints.sql`<br>`sql/011_seed_delete111.sql`<br>`sql/012_permissions_and_sku_generation_config.sql`<br>`sql/013_cpq_import_rows_canonical_and_role_baseline.sql`<br>`sql/seed.sql` |
| `user_permissions` | `app/api/users/route.ts`<br>`lib/auth.ts` |
| `user_roles` | `app/api/users/route.ts`<br>`lib/auth.ts` |
