# Process impact map

## Authentication / authorization
- Trigger: login and guarded API usage.
- Entry: `lib/auth.ts`, `lib/api-auth.ts`.
- Data impact: read-only RBAC resolution.

## Feature flags
- Trigger: nav/page load and admin flag edits.
- Entry: `/api/feature-flags/public`, `/api/feature-flags`.
- Data impact: read/write `feature_flags`, write `feature_flag_audit`.

## SKU definition lifecycle
- Trigger: Product - SKU definition CRUD.
- Entry: `/api/sku-rules`.
- Reads: `cpq_import_rows`, `cpq_product_attributes`, `audit_log`.
- Writes: `cpq_import_rows`, `audit_log`.

## Product setup
- Trigger: Setup page save.
- Entry: `/api/product-setup`.
- Reads: setup tables + active canonical digits.
- Writes: setup tables.

## CPQ generation + push
- Trigger: Create SKU page generate/push.
- Entry: `/api/cpq/options`, `/api/cpq/generate`, `/api/cpq/push`.
- Reads: `cpq_import_rows`, setup tables.
- Writes: CPQ matrix persistence chain and optional canonical references.

## CPQ matrix maintenance
- Trigger: CPQ matrix edits, bulk country update, BC checks, picture save.
- Entry: `/api/cpq-matrix*`.
- Writes: `cpq_sku_rules`, `cpq_availability`, `cpq_product_assets`, `audit_log`.

## Legacy matrix compatibility
- Trigger: when `import_csv_cpq` is false.
- Entry: `/api/matrix*`, `/api/builder-push`, `/api/countries`, `/api/setup-options`.
- Writes: legacy tables + `audit_log` + deprecation telemetry.

