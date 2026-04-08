# Database runtime inventory

Classification key: **Active / Active (admin-config) / Active (feature-flagged) / Transitional / Historical cleanup candidate / External-risk pending**.

## Inventory table

| Object | Classification | Runtime read paths | Runtime write paths | Notes | Certainty |
|---|---|---|---|---|---|
| `app_users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `user_permissions` | Active | auth + admin APIs | admin APIs (`users`, `role-permissions`) | RBAC control plane | High |
| `audit_log` | Active | `/api/sku-rules` metadata joins | `/api/sku-rules`, `/api/cpq-matrix*`, `/api/sku-rule-translations` | mutation audit stream | High |
| `feature_flags`, `feature_flag_audit` | Active | feature flag public/admin APIs | `/api/feature-flags` | includes `cpq_bdam_picture_picker` | High |
| `cpq_import_rows` | Active | `/api/sku-rules`, `/api/cpq/options`, `/api/cpq/generate`, `/api/product-setup`, `/api/cpq/push` | `/api/sku-rules`, `/api/cpq/push` | canonical CPQ option source | High |
| `cpq_import_row_translations` | Active | `/api/cpq/options`, `/api/sku-rule-translations` | `/api/sku-rule-translations` | locale overlays | High |
| `sku_digit_option_config` | Active (admin-config) | `/api/product-setup`, `/api/cpq/options`, `/api/cpq/generate` | `/api/product-setup` | digit required/single-multi rules | High |
| `sku_generation_dependency_rules` | Active (admin-config) | `/api/product-setup`, `/api/cpq/options`, `/api/cpq/generate` | `/api/product-setup` | dependency rules (`match_code`) | High |
| `cpq_products` | Active | `/api/cpq/push` duplicate checks | `/api/cpq/push` | generated product identity rows | High |
| `cpq_product_attributes` | Active | `/api/sku-rules` delete guard, flatten view source | `/api/cpq/push` | normalized attribute linkage | High |
| `cpq_products_flat` | Active (view) | `/api/cpq-matrix` | N/A | matrix projection | High |
| `cpq_sku_rules` | Active | `/api/cpq-matrix*`, matrix service | `/api/cpq/push`, `/api/cpq-matrix*` | sales matrix core rows | High |
| `cpq_availability` | Active | `/api/cpq-matrix` | `/api/cpq/push`, `/api/cpq-matrix*` | rule-country availability | High |
| `cpq_countries` | Active | matrix/options/translation/push routes | seed/admin SQL only in repo | brake + locale control | High |
| `cpq_product_assets` | Active (feature-flagged) | `/api/cpq-matrix` | `/api/cpq-matrix/picture` | picture picker metadata | High |
| `cpq_import_runs` | Transitional | `/api/cpq/generate` GET | `/api/cpq/generate` GET | diagnostic run lifecycle | High |
| `products`, `countries`, `availability`, `setup_options` | Historical cleanup candidate | none in active runtime | none in active runtime | present in baseline SQL history, absent in fresh CSV snapshot | High |
| `sku_rules` | External-risk pending | none in active runtime | none in active runtime | still physically present in fresh CSV snapshot | Medium |

## Reconciliation notes

- Fresh live-schema CSV snapshot is already cleaner than repo baseline SQL for several legacy objects.
- This makes forward-baseline SQL cleanup the highest-value next step.
- `sku_rules` should be handled with staged retirement due to non-zero external dependency uncertainty.
