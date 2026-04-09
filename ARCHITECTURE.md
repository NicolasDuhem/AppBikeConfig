# AppBikeConfig Architecture

## 1) Runtime architecture (CPQ-only)

As of **April 8, 2026**, runtime architecture is CPQ-first (with staged cleanup wave applied):
- Canonical authoring: `cpq_import_rows`
- Translation overlay: `cpq_import_row_translations`
- Config control plane: `sku_digit_option_config`, `sku_generation_dependency_rules`
- Matrix persistence: `cpq_sku_rules`, `cpq_availability`, `cpq_countries`
- Push persistence: `cpq_products`, `cpq_product_attributes`
- Optional media extension: `cpq_product_assets`
- Cross-cutting: RBAC/auth, feature flags, audit.

---

## 2) Real DB truth vs repo SQL architecture gap

Authoritative DB truth is the CSV snapshots, not `sql/schema.sql`.

Architecture-impacting gaps:
1. `sql/schema.sql` omits multiple runtime-critical tables present in CSV truth.
2. Runtime writes `role_permission_baselines_audit`; this run reconciles CSV truth and migration truth so the table is now explicitly supported.
3. `sku_rules` remains physical legacy schema despite runtime replacement by canonical CPQ import rows.

Implication:
- Architecture docs and cleanup planning must be based on CSV truth plus runtime evidence, not baseline SQL completeness assumptions.

---

## 3) Canonical CPQ truth model

## 3.1 Source-of-truth layer
- `cpq_import_rows` (active option/codes)
- `cpq_import_row_translations` (locale-specific labels)
- setup/rule config tables (digit requirements + dependencies)

## 3.2 Persistence layer
- Generated pushes materialize to `cpq_products` + `cpq_product_attributes`
- Sales matrix model lives in `cpq_sku_rules` + `cpq_availability` + country metadata

## 3.3 Operational layer
- Matrix update endpoints mutate matrix and availability
- Optional picture picker adds/updates `cpq_product_assets`

---

## 4) Legacy architecture boundary

`sku_rules` is now a historical boundary object:
- present in schema/migrations,
- not part of active runtime read/write path,
- should move to staged retirement after dependency verification.

---

## 5) Cleanup architecture strategy

## Priority 1 (correctness)
Keep/support `role_permission_baselines_audit` to avoid runtime write failures in CSV-truth environments.

## Priority 2 (safe reduction)
Prune only evidence-backed dead columns in very small batches with rollback posture.
Completed examples:
- `cpq_import_rows.raw_*` (prior wave),
- `cpq_products.position29`, `cpq_products.position30` (prior wave),
- `cpq_products.brake_reverse`, `cpq_products.brake_non_reverse` (this wave).

## Priority 3 (staged modernization)
- retain `cpq_import_runs` for current generation diagnostics lifecycle, then prune payload/retire in a dedicated run,
- reduce denormalized `cpq_products` columns by shrinking `cpq_products_flat` fallback dependency in small reversible batches,
- retire `sku_rules` object family.

---

## 6) Documentation governance updates

Operational cleanup planning now centers on:
- `docs/database-cleanup-master-plan.md`
- `docs/runtime-vs-db-gap-analysis.md`
- `docs/column-cleanup-candidates.md`
- `docs/constraint-cleanup-candidates.md`

---

## 7) Admin API documentation surface (GET-only)

A dedicated sys_admin page is available at `/admin/api-docs`.

- Purpose: internal API documentation for **GET endpoints only**.
- Discovery: endpoints are discovered dynamically from active `app/api/**/route.ts` GET handlers.
- Rendering: docs are built from `lib/api-docs.ts` (discovery + metadata enrichment).
- Security: the page is visible in navigation only for `sys_admin`, and route access is enforced server-side.
- Scope guard: POST/PUT/PATCH/DELETE methods are intentionally excluded.

