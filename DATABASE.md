# DATABASE.md

## Purpose and scope

This is the operational database source-of-truth for **AppBikeConfig in CPQ-only runtime mode**.

Reconciliation basis used for this pass:
- Runtime SQL in `app/api/**` and `lib/**`.
- Migration/baseline SQL in `sql/**`.
- Fresh schema snapshot in `database schema.csv`.
- Fresh constraints snapshot in `database constraints.csv`.
- Generated heuristic inventory in `docs/generated/db-usage-report.md`.

Date of reconciliation: **April 8, 2026**.

---

## 1) Executive reconciliation findings

1. Runtime is fully CPQ-oriented: active tables are CPQ + RBAC + feature flags + audit.
2. The fresh CSV schema/constraints snapshot contains **21 objects** and does **not** include legacy runtime-era tables (`products`, `countries`, `availability`, `setup_options`).
3. `sql/schema.sql` has now been cleaned to remove those historical objects, closing the prior **repo baseline vs live-schema gap** for `products`, `countries`, `availability`, and `setup_options`.
4. `sku_rules` still exists in the fresh CSV snapshot but appears runtime-unused outside migrations/seed and legacy checks.
5. CPQ integrity depends on a small set of constraints/FKs/checks that should be treated as non-negotiable for cleanup work.

---

## 2) Object inventory with status, evidence, and cleanup posture

### 2.1 Active runtime objects (high certainty)

| Object | Status | Runtime evidence | Constraint/relationship dependence | Cleanup posture |
|---|---|---|---|---|
| `app_users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `user_permissions` | Active | `lib/auth.ts`, `/api/users`, `/api/roles`, `/api/permissions`, `/api/role-permissions` | RBAC FK chain and unique keys are required for effective permission resolution | Keep |
| `audit_log` | Active | `/api/sku-rules`, `/api/cpq-matrix*`, `/api/sku-rule-translations` via `writeAuditLog` | FK to `app_users` for attribution | Keep |
| `feature_flags`, `feature_flag_audit` | Active | `/api/feature-flags`, `/api/feature-flags/public`, `lib/feature-flags.ts` | `feature_flags.flag_key` uniqueness and audit FK chain | Keep |
| `cpq_import_rows` | Active (canonical) | `/api/sku-rules`, `/api/cpq/options`, `/api/cpq/generate`, `/api/cpq/push`, `/api/product-setup` | status check, import-run/user FKs, uniqueness/indexes from migrations | Keep |
| `cpq_import_row_translations` | Active | `/api/sku-rule-translations`, `/api/cpq/options` | FK to canonical rows + locale key uniqueness | Keep |
| `sku_digit_option_config` | Active (admin/config) | `/api/product-setup`, `/api/cpq/options`, `/api/cpq/generate` | digit range + selection mode checks | Keep |
| `sku_generation_dependency_rules` | Active (admin/config) | `/api/product-setup`, `/api/cpq/options`, `/api/cpq/generate` | unique tuple + digit range + `rule_type=match_code` check | Keep |
| `cpq_products`, `cpq_product_attributes` | Active | `/api/cpq/push`, delete guard in `/api/sku-rules` | FK chain to canonical rows and generated rows | Keep |
| `cpq_sku_rules`, `cpq_availability`, `cpq_countries` | Active | `/api/cpq-matrix`, `/api/cpq-matrix/save-all`, `/api/cpq-matrix/bulk-update`, `lib/cpq-matrix-service.ts` | brake-type checks + availability composite PK/FKs | Keep |
| `cpq_products_flat` (view) | Active read model | `/api/cpq-matrix` joins | Depends on CPQ products + attributes shape | Keep |
| `cpq_product_assets` | Active (feature-flag gated write path) | `/api/cpq-matrix/picture`, `/api/cpq-matrix` | unique `cpq_sku_rule_id` + FK to CPQ rows | Keep |

### 2.2 Transitional object

| Object | Status | Evidence | Why transitional |
|---|---|---|---|
| `cpq_import_runs` | Transitional | `/api/cpq/generate` GET (`run_id`) updates status phases | Diagnostics/observability path is still used, but not a core day-to-day CPQ authoring path |

### 2.3 Historical or cleanup-candidate objects

| Object | Current status | Evidence of non-runtime use | Risk | Recommendation |
|---|---|---|---|---|
| `products`, `countries`, `availability`, `setup_options` | Historical schema objects (removed from forward baseline SQL/seed in this pass) | Not present in fresh CSV schema snapshot; no active runtime API writes/reads | Medium (possible external SQL dependency in pre-existing DBs) | Keep out of forward baseline; handle physical drops with explicit migration when dependency watchlist is clear |
| `sku_rules` | Historical/transitional schema artifact | Present in fresh CSV snapshot, but runtime queries use `cpq_import_rows` and CPQ tables | Medium-high (still physically present in some DBs and referenced by old migrations) | Do not drop immediately; run focused dependency verification then staged retirement |

---

## 3) Field-level operational truth (where it matters)

### 3.1 Canonical authoring: `cpq_import_rows`

High-impact columns used in runtime behavior:
- Identity/context: `id`, `import_run_id`, `row_number`, `source`.
- Option semantics: `digit_position`, `option_name`, `code_value`, `choice_value`, `normalized_option_name`.
- Lifecycle/state: `status`, `is_active`, `deactivated_at`, `deactivation_reason`, `action_attempted`.
- Attribution/timestamps: `updated_at`, `updated_by`.

Runtime behaviors tied to fields:
- Duplicate prevention and reactivation conflict checks use `(digit_position, option_name, code_value, is_active/status)`.
- Delete guard checks indirect usage via `cpq_product_attributes.cpq_import_row_id`.
- CPQ push can create fallback canonical rows (`action_attempted='reference_attribute'`) when missing.

### 3.2 Translation overlay: `cpq_import_row_translations`

Critical fields:
- Join key: `cpq_import_row_id`, `locale`.
- Payload: `translated_value`.
- Provenance: `created_by`, `updated_by`, `updated_at`.

Runtime note:
- Locale updates are constrained to locales configured on `cpq_countries.locale_code`.

### 3.3 Setup control plane

`sku_digit_option_config`:
- Critical fields: `digit_position`, `option_name`, `is_required`, `selection_mode`, `is_active`.
- Generation validity depends on these constraints for required/single/multi semantics.

`sku_generation_dependency_rules`:
- Critical fields: `source_digit_position`, `target_digit_position`, `rule_type`, `active`, `sort_order`, `notes`.
- Runtime currently assumes `rule_type='match_code'`.

### 3.4 CPQ persistence chain

`cpq_products`:
- Core identity and metadata are persisted at push time (`sku_code`, `cpq_ruleset`, brake flags, created_by/import_run_id).

`cpq_product_attributes`:
- Stores option links by `(cpq_product_id, option_name) -> cpq_import_row_id` for normalized projection and delete protection.

`cpq_sku_rules`:
- Sales matrix row identity and editable fields (`sku_code`, `cpq_ruleset`, `brake_type`, product descriptors, `bc_status`, `is_active`).

`cpq_availability`:
- Country assignment matrix keyed by `(cpq_sku_rule_id, cpq_country_id)` with `available`.

`cpq_countries`:
- Governs country-brake compatibility and locale resolution (`country`, `region`, `brake_type`, `locale_code`).

`cpq_product_assets`:
- Optional picture metadata (`asset_url`, `png_url`, `asset_id`, `notes`, selection attribution).

---

## 4) Constraints and indexes that are operationally critical

### 4.1 Must-preserve checks and FKs

From `database constraints.csv`, these are runtime-critical:
- `cpq_countries.brake_type` domain check (`reverse|non_reverse`).
- `cpq_sku_rules.brake_type` and `cpq_sku_rules.bc_status` domain checks.
- `cpq_import_rows.status` domain check.
- `sku_digit_option_config` digit range + selection mode checks.
- `sku_generation_dependency_rules` digit range + rule type check.
- FK chain:
  - `cpq_availability -> cpq_sku_rules/cpq_countries`.
  - `cpq_product_attributes -> cpq_products/cpq_import_rows`.
  - `cpq_import_row_translations -> cpq_import_rows`.
  - Auth/audit FKs to `app_users`.

### 4.2 Index/unique constraints used by logic

Enforced in migrations and relied upon by API behavior:
- Active duplicate prevention on CPQ SKU rows (`cpq_sku_rules_active_unique` concept).
- Canonical structural uniqueness for active import rows (`cpq_import_rows_active_structural_uniq` migration path).
- Unique row-locale translation key.
- Unique `(cpq_product_id, option_name)` attribute pairing.
- Composite uniqueness/PK for availability rule-country pairs.

---

## 5) Runtime-vs-schema discrepancies to track

1. **Fresh CSV schema excludes `products/countries/availability/setup_options`, and forward baseline SQL now matches that posture.**
   - Interpretation: this historical baseline mismatch is resolved in-repo; physical legacy tables may still exist only in older provisioned environments.
2. `sku_rules` persists in both repo SQL and fresh CSV schema but is not a runtime table.
3. Repo migration history still contains legacy-era index/constraint maintenance for `sku_rules`; this remains acceptable for historical replay while retirement is staged.

---

## 6) Cleanup/removal readiness matrix

| Object family | Removal readiness | Prerequisites | Certainty |
|---|---|---|---|
| `products`, `countries`, `availability`, `setup_options` definitions in repo baseline SQL/docs | **Completed in this pass** | Baseline definitions and seed rows removed; continue external dependency watch for physical DB cleanup sequencing | High |
| `sku_rules` table and its legacy indexes/constraints | **Prepare-only (not immediate drop)** | Run dependency watchlist verification (external SQL clients, reporting jobs, ad-hoc scripts), then stage deprecation migration | Medium |
| Legacy references in non-authoritative docs/artifacts | **Safe now** | Update generated/runtime inventory and retirement docs in same PR | High |

---

## 7) Recommended next cleanup step (concrete)

**Next run should be a guarded physical-cleanup preparation pass with this sequence:**

1. **Stage 1 (completed):** historical table definitions (`products`, `countries`, `availability`, `setup_options`) were removed from forward baseline docs/`sql/schema.sql` and no longer seeded.
2. **Stage 2 (next):** run dependency verification for `sku_rules` and historical physical tables in existing DBs; then add a deprecation/retirement migration plan (comment metadata or archive naming) without hard drop.
3. **Stage 3 (after verification window):** execute physical drop migrations for staged legacy objects (`sku_rules` and any remaining historical tables), including legacy indexes/constraints cleanup.

Rollback posture:
- Stage 2 rollback: pause retirement and retain objects unchanged.
- Stage 3 rollback: restore from migration down scripts or schema backup snapshot.

---

## 8) Supporting analysis artifacts

- `docs/generated/db-usage-report.md` (heuristic table-reference scan).
- `docs/database-runtime-inventory.json` (machine-readable object inventory).
- `docs/database-runtime-inventory.md` (human summary).
- `docs/database-cleanup-recommendations.md` (sequenced retirement plan with risks/prereqs).
