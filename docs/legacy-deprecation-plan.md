# Legacy compatibility deprecation plan (evidence-first)

## Executive summary

This repository currently runs a **canonical CPQ track** and a **legacy compatibility track** behind `feature_flags.import_csv_cpq`. The canonical path is the target for all new work. The legacy path remains for fallback/rollback safety and potentially unknown external consumers.

This document focuses on **safe retirement preparation**, not immediate deletion.

## Confirmed legacy/runtime surfaces and classification

| Candidate | Category | Reachability now | In-repo evidence | External dependency risk | Telemetry status | Do-not-extend now? | Risk |
|---|---|---|---|---|---|---|---|
| `/matrix` + `/api/matrix*` + `products/countries/availability` | Legacy feature-flagged (active fallback) | Nav when `import_csv_cpq=false`; direct URL possible; API callable regardless of nav | `components/app-navigation.tsx`, `app/matrix/page.tsx`, `app/api/matrix/*`, `lib/matrix-service.ts`, `app/order/page.tsx` | Medium (direct API callers unknown) | `deprecation.path_invoked` enabled on all major `/api/matrix*` routes | **Yes** | High |
| `/api/builder-push` + `/bike-builder` | Legacy feature-flagged | Hidden from nav when CPQ on; direct URL and API still callable | `components/app-navigation.tsx`, `app/bike-builder/page.tsx`, `app/api/builder-push/route.ts` | Medium | `deprecation.path_invoked` enabled | **Yes** | Medium |
| `/api/countries` | Legacy partially reachable | No primary nav entry; API callable directly and by compatibility tooling | `app/api/countries/route.ts` | Medium | `deprecation.path_invoked` enabled (GET/POST) | **Yes** | Medium |
| `/api/setup-options` + `setup_options` | Legacy partially reachable | No linked UI in current nav; API direct-call reachable | `app/api/setup-options/route.ts` | Medium | `deprecation.path_invoked` enabled (GET/POST/DELETE) | **Yes** | Medium |
| `sku_rules` | Migration-era residual | Not in active runtime API path; appears in SQL backfills/seeds/migrations | `sql/*.sql` | Medium | N/A (schema-level residual) | **Yes** | Medium |
| `cpq_import_runs` (`/api/cpq/generate?run_id=`) | Migration-era residual still callable | GET route callable by role; updates run phase/status | `app/api/cpq/generate/route.ts` | Medium | `deprecation.path_invoked` enabled on GET run path | **Yes** (except diagnostics) | Medium |
| `cpq_import_row_translations` | Unused in repo | No active runtime references discovered | `sql/010_cpq_normalized_attributes_and_translations.sql` (definition only) | High (unknown downstream reporting/export users) | N/A | **Yes** | Low |
| compatibility text payload columns in `cpq_products` | Secondary deprecation candidate | Still populated by `/api/cpq/push`; read path primarily via `cpq_products_flat` | `app/api/cpq/push/route.ts`, `sql/010_*` | Medium | Existing audit on push; no column-specific telemetry | **Yes** | Medium |

## Reachability map (explicit answers)

1. **Are `/matrix` flows still reachable from navigation?** Yes, when `import_csv_cpq=false`; otherwise `/matrix` redirects to `/cpq-matrix`, but direct URL/API access is still possible.
2. **Is `/api/builder-push` connected to live UI?** Yes through `/bike-builder` when CPQ flag is off; otherwise hidden in nav but still directly reachable.
3. **Is `setup_options` still used?** API remains callable, but current in-repo primary setup UI uses `/api/product-setup`; classify as residual compatibility path.
4. **Is `sku_rules` operationally relevant?** Not primary runtime; still used by migration/seed/backfill logic.
5. **Is `cpq_import_runs` still live?** Yes for GET diagnostic generation flow using `run_id`.
6. **Is `cpq_import_row_translations` unused in repo?** No in-repo runtime callers found.

## Telemetry now in place

`audit_log` receives `action_key='deprecation.path_invoked'`, `entity_type='legacy_runtime_path'` for:

- `/api/matrix` GET/POST
- `/api/matrix/save-all`
- `/api/matrix/bulk-update`
- `/api/matrix/check-bc-status`
- `/api/builder-push`
- `/api/countries` GET/POST
- `/api/setup-options` GET/POST/DELETE
- `/api/cpq/generate` GET diagnostics (`run_id`)

## Safe removal gates

A candidate is removable only when all gates below are met:

1. **Telemetry gate:** at least 30 days of zero invocations in production.
2. **Flag gate:** lower environments run with `import_csv_cpq=true` continuously without business regression.
3. **Dependency gate:** confirm no external job/integration uses the route/table.
4. **Rollback gate:** documented rollback path exists for one release cycle.

## Ordered retirement sequence (recommended)

1. **Freeze expansion now** (do-not-extend policy + CI warning script).
2. **Retire legacy write paths first**: `/api/builder-push`, `/api/setup-options`.
3. **Then retire matrix write mutators**: `/api/matrix/save-all`, `/api/matrix/bulk-update`, `/api/matrix` POST.
4. **Then retire matrix reads**: `/api/matrix` GET and `/matrix` page.
5. **Only after runtime retirement, drop tables** `availability` -> `products`/`countries` (single migration bundle with rollback plan).
6. **Finally remove residuals** `cpq_import_runs` diagnostics and compatibility columns after dependency confirmation.

## Unknowns requiring production validation

- External integrations that might call `/api/matrix*`, `/api/builder-push`, `/api/setup-options`, `/api/countries` directly.
- Reporting pipelines that might still query compatibility columns in `cpq_products`.
- Any out-of-repo process using `cpq_import_row_translations` or `cpq_import_runs` directly.
