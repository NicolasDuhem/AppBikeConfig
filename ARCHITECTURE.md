# AppBikeConfig Architecture

## 1) Runtime architecture (validated)

AppBikeConfig is actively running a **dual-track runtime** controlled by `feature_flags.import_csv_cpq`:

- **CPQ canonical track (primary):** `/cpq-feature`, `/cpq-matrix`, `/api/cpq/*`, `/api/cpq-matrix/*`, canonical rows in `cpq_import_rows`, normalized attributes in `cpq_product_attributes`, and sales matrix in `cpq_sku_rules` + `cpq_availability` + `cpq_countries`.
- **Legacy compatibility track (fallback):** `/matrix`, `/api/matrix*`, `/api/builder-push`, `/api/countries`, and legacy tables `products` + `availability` + `countries`.

Routing/UI evidence:
- `components/app-navigation.tsx` switches Matrix target by `import_csv_cpq` and hides legacy builder when CPQ is on.
- `app/matrix/page.tsx` redirects to `/cpq-matrix` when CPQ flag is enabled.
- `app/cpq-feature/page.tsx` redirects to legacy builder when CPQ flag is disabled.

## 2) Identity, RBAC, and audit

- Auth source: `app_users` via credentials provider in `lib/auth.ts`.
- Effective permissions merge role baseline (`role_permissions`) and user overrides (`user_permissions`).
- Operational writes record to `audit_log` through `lib/audit.ts`.

## 3) Canonical data model status

### 3.1 Canonical SKU definition
`cpq_import_rows` is the active source for Product - SKU definition and CPQ option hydration.

`cpq_import_row_translations` now provides optional locale overrides per canonical row (`cpq_import_row_id + locale`) managed from the Product - SKU definition > Translations subsection. Locale options come from `cpq_countries.locale_code`.

### 3.2 Generation and push
- `/api/cpq/options` reads active `cpq_import_rows` + setup config.
- `/api/cpq/generate` POST builds combinations in-memory.
- `/api/cpq/push` persists to `cpq_products`, `cpq_product_attributes`, `cpq_sku_rules`, `cpq_availability`.

### 3.3 Matrix runtime
- CPQ matrix reads from `cpq_sku_rules`, `cpq_products_flat`, `cpq_product_assets`, and `cpq_availability`.
- Legacy matrix reads from `products`, `countries`, `availability`.

## 4) Legacy/deprecation observability

A shared telemetry helper now records deprecation-candidate path usage into `audit_log` with `action_key='deprecation.path_invoked'` and `entity_type='legacy_runtime_path'`.

Instrumented paths:
- `/api/matrix` (GET/POST)
- `/api/matrix/save-all`
- `/api/matrix/bulk-update`
- `/api/matrix/check-bc-status`
- `/api/builder-push`
- `/api/setup-options` (GET/POST/DELETE)
- `/api/countries` (GET/POST)
- `/api/cpq/generate` GET (`run_id` diagnostics path tied to `cpq_import_runs`)

## 5) Active vs compatibility vs uncertain

- **Active canonical:** `cpq_import_rows`, `cpq_import_row_translations`, `cpq_product_attributes`, `cpq_sku_rules`, `cpq_countries` (including `locale_code`), `cpq_availability`, `sku_digit_option_config`, `sku_generation_dependency_rules`.
- **Compatibility still runtime-reachable:** `products`, `countries`, `availability`, `/api/builder-push`, `/api/setup-options`.
- **Partial migration-era:** `cpq_import_runs` (GET diagnostics updates still reachable; no in-repo create flow).

## 6) Documentation governance

Any data behavior change must update both:
- `DATABASE.md` (schema/data reality)
- `PROCESSDATA.md` (runtime process flow)

Guardrails added:
- `CONTRIBUTING.md` checklist
- `.github/pull_request_template.md` checklist
- `scripts/check-doc-governance.mjs`


## 7) Deprecation posture

- Legacy compatibility surfaces are explicitly **do-not-extend** unless the change is directly for deprecation safety/telemetry.
- New product capabilities must target canonical CPQ routes/tables first.
- Removal sequencing and risk gating are tracked in `docs/legacy-deprecation-plan.md`.
