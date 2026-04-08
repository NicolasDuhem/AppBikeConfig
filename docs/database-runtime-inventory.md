# Database runtime inventory

Classification key: Active / Active (feature-flagged) / Transitional / Historical-cleanup-candidate.

| Object | Classification | Read paths | Write paths | Certainty |
|---|---|---|---|---|
| `cpq_import_rows` | Active | `/api/sku-rules`, `/api/cpq/options`, `/api/cpq/generate`, `/api/product-setup` | `/api/sku-rules`, `/api/cpq/push` | High |
| `cpq_import_row_translations` | Active | `/api/cpq/options`, `/api/sku-rule-translations` | `/api/sku-rule-translations` | High |
| `sku_digit_option_config`, `sku_generation_dependency_rules` | Active | `/api/product-setup`, `/api/cpq/options`, `/api/cpq/generate` | `/api/product-setup` | High |
| `cpq_product_attributes` | Active | `/api/sku-rules` delete guard | `/api/cpq/push` | High |
| `cpq_products` | Active | `/api/cpq/push` duplicate checks | `/api/cpq/push` | High |
| `cpq_products_flat` | Active view | `/api/cpq-matrix` | N/A | High |
| `cpq_sku_rules` | Active | `/api/cpq-matrix*` | `/api/cpq/push`, `/api/cpq-matrix*` | High |
| `cpq_availability` | Active | `/api/cpq-matrix` | `/api/cpq/push`, `/api/cpq-matrix*` | High |
| `cpq_countries` | Active | `/api/cpq-matrix*`, `/api/cpq/options`, `/api/sku-rule-translations`, `/api/cpq/push` | seed/migration only in repo | High |
| `cpq_product_assets` | Active (feature-flagged) | `/api/cpq-matrix` | `/api/cpq-matrix/picture` | High |
| `cpq_import_runs` | Transitional | `/api/cpq/generate` GET | `/api/cpq/generate` GET | High |
| `products`, `countries`, `availability` | Historical-cleanup-candidate | none in active runtime code | none in active runtime code | High |
| `setup_options` | Historical-cleanup-candidate | none in active runtime code | none in active runtime code | High |
| `sku_rules` | Historical-cleanup-candidate | migrations/seeds only | migrations/seeds only | Medium |
