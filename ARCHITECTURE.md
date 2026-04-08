# AppBikeConfig Architecture

## 1) Runtime architecture (CPQ-only)

As of **April 8, 2026**, AppBikeConfig runs a **single production runtime track**:

- CPQ Product definition and generation (`/sku-definition`, `/cpq-feature`, `/api/sku-rules`, `/api/cpq/options`, `/api/cpq/generate`, `/api/cpq/push`)
- CPQ Sales matrix operations (`/cpq-matrix`, `/api/cpq-matrix/*`)
- CPQ setup control plane (`/setup`, `/api/product-setup`)

The previous dual-runtime model (`import_csv_cpq` switching between CPQ and legacy Matrix/Builder flows) is retired.

## 2) Routing posture

### Active routes
- `/` -> redirects to `/cpq-matrix`
- `/cpq-matrix` -> canonical Sales - SKU vs Country surface
- `/cpq-feature` -> canonical Product - Create SKU
- `/sku-definition` -> canonical SKU rule management
- `/setup` -> canonical setup configuration

### Transitional redirects kept
- `/matrix` -> `/cpq-matrix`
- `/bike-builder` -> `/cpq-feature`
- `/order` -> `/cpq-matrix`

These redirects remain for bookmark continuity only; they are not alternate runtime modes.

## 3) Identity, RBAC, and audit

- Authentication is credentials-based (`next-auth`) backed by `app_users`.
- Effective permissions are the merge of role baselines and user overrides.
- Mutating operations write audit records via `lib/audit.ts`.
- A small deprecation telemetry helper remains only for `/api/cpq/generate?run_id=` transitional diagnostics instrumentation.

## 4) Canonical CPQ data model

### 4.1 Canonical definition source
- `cpq_import_rows` is the source of truth for option structure and active/inactive lifecycle.
- `cpq_import_row_translations` stores locale overlays for display labels.

### 4.2 Generation and push
- `/api/cpq/options` hydrates selectable options from canonical rows + setup tables.
- `/api/cpq/generate` (POST) builds combinations in memory.
- `/api/cpq/push` persists generated output into:
  - `cpq_products`
  - `cpq_product_attributes`
  - `cpq_sku_rules`
  - `cpq_availability`

### 4.3 Sales matrix runtime
- `/api/cpq-matrix` and companion mutation endpoints operate on:
  - `cpq_sku_rules`
  - `cpq_availability`
  - `cpq_countries`
  - `cpq_products_flat`
  - `cpq_product_assets` (picture metadata path)

## 5) Feature flags

- `cpq_bdam_picture_picker` is active and runtime-relevant.
- `import_csv_cpq` is historical-only state and must not be used to branch runtime behavior.

## 6) Legacy object status after Run 2 cleanup

### Removed from runtime code
- `/api/matrix*`
- `/api/builder-push`
- `/api/countries`
- `/api/setup-options`
- `lib/matrix-service.ts`

### Still present in DB schema (historical objects)
- `products`, `countries`, `availability`, `setup_options`, `sku_rules`

These legacy tables are no longer read/written by active runtime code in this repository.

## 7) Documentation governance

When behavior or persistence changes, update both:
- `DATABASE.md`
- `PROCESSDATA.md`
