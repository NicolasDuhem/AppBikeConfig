# Process impact map

## Authentication / authorization
- Trigger: login and guarded API usage.
- Entry: `lib/auth.ts`, `lib/api-auth.ts`.
- Data impact: RBAC resolution reads only.

## Feature flags
- Trigger: nav/page load and admin flag edits.
- Entry: `/api/feature-flags/public`, `/api/feature-flags`.
- Data impact: read/write `feature_flags`, write `feature_flag_audit`.

## SKU definition + translations
- Trigger: Product - SKU definition edits and locale value maintenance.
- Entry: `/api/sku-rules`, `/api/sku-rule-translations`.
- Reads: `cpq_import_rows`, `cpq_import_row_translations`, `cpq_product_attributes`, `cpq_countries`.
- Writes: `cpq_import_rows`, `cpq_import_row_translations`, `audit_log`.

## Product setup
- Trigger: Product - Setup reads/saves.
- Entry: `/api/product-setup`.
- Reads: setup tables + active canonical digits.
- Writes: setup tables.

## CPQ generation + push
- Trigger: Create SKU generate/push.
- Entry: `/api/cpq/options`, `/api/cpq/generate`, `/api/cpq/push`.
- Reads: canonical rows, setup tables, locale/country mapping.
- Writes: CPQ matrix persistence chain + optional canonical support writes.

## CPQ matrix maintenance
- Trigger: matrix edits, bulk assignment, BC checks, picture save.
- Entry: `/api/cpq-matrix*`.
- Reads: `cpq_sku_rules`, `cpq_products_flat`, `cpq_availability`, `cpq_countries`, optional assets.
- Writes: `cpq_sku_rules`, `cpq_availability`, `cpq_product_assets`, `audit_log`.

## Historical-only (removed runtime APIs)
- Removed: `/api/matrix*`, `/api/builder-push`, `/api/countries`, `/api/setup-options`.
- Legacy DB tables remain physically present but have no active runtime path in repository code.
