# Database runtime inventory

Classification key: Active / Active (feature-flagged) / Compatibility only / Partial / Unused / Unknown external dependency risk.

| Object | Classification | Read paths | Write paths | Certainty |
|---|---|---|---|---|
| `cpq_import_rows` | Active | `/api/sku-rules`, `/api/cpq/options`, `/api/cpq/generate`, `/api/product-setup` | `/api/sku-rules`, `/api/cpq/push` | High |
| `cpq_product_attributes` | Active | `/api/sku-rules` delete guard | `/api/cpq/push` | High |
| `cpq_products` | Active | `/api/cpq/push` duplicate checks | `/api/cpq/push` | High |
| `cpq_products_flat` | Active compatibility view | `/api/cpq-matrix` | N/A | High |
| `cpq_sku_rules` | Active | `/api/cpq-matrix*`, `/api/cpq-matrix/check-bc-status` | `/api/cpq/push`, `/api/cpq-matrix*` | High |
| `cpq_availability` | Active | `/api/cpq-matrix` | `/api/cpq/push`, `/api/cpq-matrix*` | High |
| `cpq_countries` | Active | `/api/cpq-matrix*`, `/api/cpq/push` | seed/migration only in repo | High |
| `cpq_product_assets` | Active (feature-flagged) | `/api/cpq-matrix` | `/api/cpq-matrix/picture` | High |
| `cpq_import_runs` | Partial | `/api/cpq/generate` GET | `/api/cpq/generate` GET | High |
| `setup_options` | Compatibility only | `/api/setup-options` | `/api/setup-options` | High |
| `products`, `countries`, `availability` | Compatibility only | `/api/matrix*`, `/api/countries` | `/api/matrix*`, `/api/builder-push`, `/api/countries` | High |
| `sku_rules` | Partial/migration-era | migrations/seeds | migrations/seeds | Medium |
| `cpq_import_row_translations` | Unused in repo | none found | none found | Medium |

