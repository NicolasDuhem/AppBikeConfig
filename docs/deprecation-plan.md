# Deprecation plan (runtime-evidence oriented)

## Telemetry in place

Audit-backed path invocation telemetry (`action_key=deprecation.path_invoked`) now covers:
- legacy matrix APIs (`/api/matrix*`)
- legacy builder push (`/api/builder-push`)
- legacy setup options API (`/api/setup-options`)
- migration-era import-run generation GET (`/api/cpq/generate?run_id=`)

## Candidate retirement roadmap

| Candidate | Evidence needed before removal | Current protection | Risk |
|---|---|---|---|
| Legacy matrix routes + `products/countries/availability` | 30+ days of zero production invocations + stakeholder signoff | `feature_flags.import_csv_cpq` | High |
| `/api/builder-push` | zero invocations + no external integrator dependency | UI hidden when CPQ on, but API reachable | Medium |
| `/api/setup-options` + `setup_options` | zero invocations + confirm no admin workflows use it | none beyond auth | Medium |
| `cpq_import_runs` diagnostic GET flow | confirm no jobs/users rely on run-based diagnostics | auth + telemetry | Medium |
| `cpq_import_row_translations` | external dependency audit confirms unused | none | Low |
| compatibility text columns in `cpq_products` | verify exports/reporting no longer read fallback fields | normalized view exists | Medium |

## Recommended sequence

1. Collect telemetry for at least one full business cycle.
2. Lock CPQ mode on in lower environments, validate no regressions.
3. Deprecate legacy API routes (warn headers/logging), then remove UI links.
4. Remove legacy writes first, keep read-only fallback briefly if needed.
5. Drop compatibility tables/columns in final migration only after external dependency review.

## Known uncertainty

- External consumers are not fully visible from this repository; any object with no in-repo usage remains a potential integration risk until production traffic and downstream reporting are audited.
