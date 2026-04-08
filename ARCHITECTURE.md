# AppBikeConfig Architecture

## 1) Runtime architecture (CPQ-only as of April 8, 2026)

AppBikeConfig now runs a **single canonical runtime track**:

- **CPQ runtime (only supported operational path):** `/cpq-feature`, `/cpq-matrix`, `/api/cpq/*`, `/api/cpq-matrix/*`, canonical SKU-definition rows in `cpq_import_rows`, normalized generated attributes in `cpq_product_attributes`, and sales-availability state in `cpq_sku_rules` + `cpq_availability` + `cpq_countries`.

The prior dual-track design (`feature_flags.import_csv_cpq` switching between CPQ and legacy runtime) is retired for runtime behavior. `import_csv_cpq` remains as a historical feature-flag record only and is no longer used to route or gate runtime paths.

### Runtime navigation and entry-point posture

- Primary navigation points directly to CPQ pages (`/cpq-matrix`, `/cpq-feature`) and no longer presents legacy Matrix or Product Legacy Builder as standard runtime flows.
- `/` now resolves directly to CPQ matrix (`/cpq-matrix`).
- Legacy UI routes `/matrix` and `/bike-builder` are transition redirects to CPQ routes (`/cpq-matrix`, `/cpq-feature`) and are not treated as supported runtime modes.

## 2) Identity, RBAC, and audit

- Auth source: `app_users` via credentials provider in `lib/auth.ts`.
- Effective permissions merge role baseline (`role_permissions`) and user overrides (`user_permissions`).
- Operational writes record to `audit_log` through `lib/audit.ts`.
- Legacy-path invocation telemetry continues to write `audit_log` entries with `action_key='deprecation.path_invoked'` for still-existing compatibility APIs.

## 3) Canonical data model

### 3.1 Canonical SKU definition

`cpq_import_rows` is the source-of-truth for Product - SKU definition and CPQ option hydration.

`cpq_import_row_translations` provides optional locale overlays keyed by (`cpq_import_row_id`, `locale`), managed by `/api/sku-rule-translations` and consumed by `/api/cpq/options`.

Locale resolution order for options:
1. explicit request locale (if managed),
2. country default locale via `cpq_countries.locale_code` when country context is passed,
3. managed default locale (first configured locale, otherwise `en-US`).

Missing/blank translation values always fall back to canonical `cpq_import_rows.choice_value`.

### 3.2 Generation and push

- `/api/cpq/options` reads active canonical rows + setup config (+ translations by resolved locale).
- `/api/cpq/generate` POST builds SKU combinations in memory.
- `/api/cpq/push` persists generated selections to `cpq_products`, `cpq_product_attributes`, `cpq_sku_rules`, and `cpq_availability`.

### 3.3 Matrix runtime

- CPQ matrix (`/cpq-matrix`) reads/writes through `cpq_sku_rules`, `cpq_products_flat`, `cpq_availability`, `cpq_countries`, and optional `cpq_product_assets`.
- BigCommerce status checks and picture-picker writes are CPQ matrix adjunct behavior.

## 4) Legacy runtime status after cutover

### Retired from runtime standard behavior

- Legacy Matrix runtime model (`/matrix` + `/api/matrix*` as primary behavior model).
- Legacy Product Builder runtime model (`/bike-builder` + `/api/builder-push` as primary behavior model).
- Feature-flag branch model that switched runtime behavior based on `import_csv_cpq`.

### Still present but compatibility/deprecation scope

- Legacy APIs and legacy tables may still exist for controlled cleanup sequencing and direct-call risk management.
- Existing deprecation telemetry remains active on compatibility endpoints to measure residual usage before removal.

## 5) Feature flag model

- `cpq_bdam_picture_picker`: still active runtime flag for CPQ picture picker behavior.
- `import_csv_cpq`: **retired as runtime switch**. No runtime route, page, or primary UX behavior should depend on it.

## 6) Active vs compatibility vs historical

- **Active canonical runtime:** `cpq_import_rows`, `cpq_import_row_translations`, `cpq_product_attributes`, `cpq_products`, `cpq_products_flat`, `cpq_sku_rules`, `cpq_countries`, `cpq_availability`, `cpq_product_assets`, `sku_digit_option_config`, `sku_generation_dependency_rules`.
- **Compatibility/deprecation surfaces (not runtime standard):** legacy pages/paths and APIs tied to `products/countries/availability` and `setup_options`.
- **Historical/transitional artifacts:** `import_csv_cpq` flag state and dual-track deprecation planning material.

## 7) Documentation governance

Any behavior change touching runtime data flows must update both:
- `DATABASE.md` (schema/data truth)
- `PROCESSDATA.md` (runtime flow truth)

Guardrails:
- `CONTRIBUTING.md` checklist
- `.github/pull_request_template.md` checklist
- `scripts/check-doc-governance.mjs`

## 8) Run 2 direction

This cutover establishes CPQ-only runtime behavior. A follow-up Run 2 can remove remaining compatibility-only API/table code once telemetry and integration checks confirm safe deletion.
