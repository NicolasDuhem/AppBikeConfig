# Database cleanup recommendations (CPQ-only reconciliation)

Date: **April 8, 2026**

This document provides a concrete, sequenced cleanup/removal plan grounded in:
- runtime code references,
- migration/baseline SQL,
- `database schema.csv`,
- `database constraints.csv`.

## 1) Decision table: historical objects and retirement posture

| Object | Current status | Evidence | Risk level | Recommendation | Prerequisites | Certainty |
|---|---|---|---|---|---|---|
| `products` | Historical (repo baseline only) | Appears in `sql/schema.sql` and seed SQL; absent from fresh CSV schema; no runtime API reads/writes | Medium | Remove from forward baseline SQL and seeds | External dependency check (reporting/jobs/manual SQL) | High |
| `countries` (legacy) | Historical (repo baseline only) | Same as above; runtime uses `cpq_countries` | Medium | Remove from forward baseline SQL and seeds | External dependency check | High |
| `availability` (legacy) | Historical (repo baseline only) | Same as above; runtime uses `cpq_availability` | Medium | Remove from forward baseline SQL and seeds | External dependency check | High |
| `setup_options` | Historical (repo baseline only) | Defined in baseline SQL; runtime uses setup config tables | Medium | Remove from forward baseline SQL and seeds | External dependency check | High |
| `sku_rules` | Historical/transitional physical object | Present in fresh CSV schema + legacy migrations; runtime path uses `cpq_import_rows` | Medium-high | Stage deprecation first; drop only after watchlist clears | Direct dependency verification + grace window | Medium |
| Legacy indexes/constraints on `sku_rules` | Historical technical debt | Present in old SQL migrations/constraints logic | Medium | Remove when `sku_rules` removal executes | Same as `sku_rules` | Medium |

## 2) External dependency watchlist (must clear before destructive drops)

Run and capture evidence for:
1. BI/reporting queries against legacy names (`products`, `countries`, `availability`, `setup_options`, `sku_rules`).
2. Scheduled jobs/ETLs outside repo that still hit legacy objects.
3. Manual SQL tooling/playbooks used by operations teams.
4. Any partner integrations reading legacy views/tables directly.

If any are found, create migration bridge plan first (view aliases, temporary compatibility views, or consumer cutover date).

## 3) Sequenced execution plan

## Phase A — Immediate cleanup prep (next run)

1. Update `sql/schema.sql` to remove legacy table definitions that are absent from live schema snapshot:
   - `products`
   - `countries`
   - `availability`
   - `setup_options`
2. Update `sql/seed.sql` to remove legacy inserts tied exclusively to those objects.
3. Keep explicit notes that `sku_rules` remains staged-retained pending verification.

Rollback: restore removed definitions from version control.

## Phase B — Guarded `sku_rules` retirement prep

1. Add migration to mark `sku_rules` as deprecated (comment metadata or rename-to-archive strategy).
2. Add one-cycle monitoring period for query logs/external clients.
3. Verify no read/write traffic except historical migration replay.

Rollback: keep table unchanged and stop at deprecation stage.

## Phase C — Final removal

1. Drop `sku_rules` and attached legacy-only indexes/constraints.
2. Remove remaining legacy migration fragments that only support `sku_rules`.
3. Regenerate schema snapshots and docs to confirm zero residual legacy objects.

Rollback: restore from pre-drop backup snapshot or reverse migration.

## 4) Constraint/index retirement candidates

Retire only when corresponding object is retired:
- `sku_rules_active_digit_code_nonzero_uniq`.
- `sku_rules_active_static_option_code_uniq`.
- `sku_rules_active_lookup_idx`.
- `chk_code_value_format` and similar table-level checks tied to `sku_rules`.

Do **not** retire CPQ constraints that enforce live invariants (`cpq_sku_rules`, `cpq_availability`, setup table checks).

## 5) Best next action recommendation

**Recommended next Codex run:**

> Execute a migration/baseline cleanup focused on removing legacy baseline definitions (`products`, `countries`, `availability`, `setup_options`) from `sql/schema.sql` and `sql/seed.sql`, while preparing (not yet dropping) `sku_rules` with an explicit external dependency verification checklist.

Rationale:
- Highest confidence, lowest runtime risk cleanup is available now.
- This reduces schema debt immediately while preserving safe staged handling for the only medium-certainty object (`sku_rules`).
