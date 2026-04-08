# DATABASE.md

## Purpose

Operational database reference for the **CPQ-only** AppBikeConfig runtime (post-cutover cleanup).

This document classifies each important object as:
- **Active** (used by current runtime code),
- **Transitional** (still used but not a core steady-state path),
- **Historical / cleanup candidate** (exists in schema but unused by runtime code in this repo).

## 1) Runtime inventory and status

| Object(s) | Status | Certainty | Runtime notes |
|---|---|---:|---|
| `app_users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `user_permissions` | Active | High | Authentication and RBAC resolution for page/API access control. |
| `audit_log` | Active | High | Audit stream for mutating operations and transitional diagnostics events. |
| `feature_flags`, `feature_flag_audit` | Active | High | Feature-flag management remains active; runtime-relevant flag is `cpq_bdam_picture_picker`. |
| `cpq_import_rows` | Active (canonical) | High | Source-of-truth option rows for SKU definition and generation input. |
| `cpq_import_row_translations` | Active | High | Locale overlay values for option labels returned by CPQ options flow. |
| `sku_digit_option_config`, `sku_generation_dependency_rules` | Active | High | Product setup control plane for generation validation/constraints. |
| `cpq_products`, `cpq_product_attributes` | Active | High | Persisted generated product identity plus normalized attribute rows. |
| `cpq_sku_rules`, `cpq_availability`, `cpq_countries` | Active | High | Canonical Sales SKU-vs-country runtime state including brake-type and locale behavior. |
| `cpq_products_flat` (view) | Active | High | Primary read projection for matrix table rendering. |
| `cpq_product_assets` | Active (flag-gated writes) | High | Picture-picker metadata persisted when feature flag is enabled. |
| `cpq_import_runs` | Transitional | High | Still used by `/api/cpq/generate?run_id=` diagnostics/status flow. |
| `products`, `countries`, `availability` | Historical / cleanup candidate | High | Legacy matrix data model; no active runtime callers remain in repo code. |
| `setup_options` | Historical / cleanup candidate | High | Legacy setup model; replaced by setup config tables. |
| `sku_rules` | Historical / cleanup candidate | Medium | Migration/seed-era object retained in schema scripts; not active runtime source. |

## 2) Canonical CPQ objects (field-aware operational notes)

### 2.1 `cpq_import_rows`

Runtime-significant fields:
- identity/lifecycle: `id`, `status`, `is_active`, `deactivated_at`, `deactivation_reason`
- option structure: `digit_position`, `option_name`, `code_value`, `choice_value`
- provenance: `import_run_id`, `source`, `action_attempted`, `updated_at`, `updated_by`

Usage:
- CRUD and activation logic in SKU definition,
- option hydration in `/api/cpq/options`,
- generation input shaping in `/api/cpq/generate`,
- optional canonical backfill paths in `/api/cpq/push`.

### 2.2 `cpq_import_row_translations`

Runtime-significant fields:
- key: (`cpq_import_row_id`, `locale`)
- payload: `translated_value`
- provenance: `created_at`, `created_by`, `updated_at`, `updated_by`

Usage:
- translation overlay reads in `/api/cpq/options`,
- translation management writes via `/api/sku-rule-translations`,
- canonical fallback when translation is null/blank.

### 2.3 `cpq_products` + `cpq_product_attributes`

`cpq_products` key fields:
- `id`, `sku_code`, `cpq_ruleset`, `import_run_id`
- brake semantics: `brake_reverse`, `brake_non_reverse`

`cpq_product_attributes` key fields:
- `cpq_product_id`, `option_name`, `option_value`

Usage:
- persisted output of CPQ push,
- downstream flattening and matrix render/filter support.

### 2.4 `cpq_sku_rules` + `cpq_availability` + `cpq_countries`

- `cpq_sku_rules`: matrix row identity/state (`id`, `sku_code`, `cpq_ruleset`, `brake_type`, `bc_status`, `is_active` plus editable fields).
- `cpq_availability`: availability key/value by (`cpq_rule_id`, `cpq_country_id`) and `available`.
- `cpq_countries`: country metadata including `brake_type` and `locale_code`.

Usage:
- full Sales matrix read/write lifecycle,
- brake compatibility validation on bulk/single edits,
- locale default resolution for translated option values.

### 2.5 `sku_digit_option_config` + `sku_generation_dependency_rules`

Usage:
- generation-time constraints (required digits, single/multi selection mode, dependency matching),
- Product - Setup admin editing and persistence.

## 3) Constraints and invariants that matter to runtime correctness

Critical invariants include:
- structural uniqueness for active canonical rows in `cpq_import_rows`,
- active row uniqueness in `cpq_sku_rules` by business key,
- uniqueness in `cpq_product_attributes` (`cpq_product_id`, `option_name`) for idempotent upserts,
- uniqueness in `cpq_availability` per rule-country pair,
- foreign-key integrity in RBAC joins,
- brake/status domain checks for matrix consistency.

## 4) Legacy object reclassification (post-cutover reality)

### `products`, `countries`, `availability`
- **Current status:** historical only in app runtime.
- **Evidence:** no active `/api/matrix*` or matrix service callers in repo runtime code.
- **Risk:** possible unknown external DB consumers outside this repository.
- **Removal prerequisite:** explicit downstream dependency check and migration/backfill strategy for any external SQL consumers.

### `setup_options`
- **Current status:** historical only in app runtime.
- **Evidence:** no `/api/setup-options` route remains.
- **Removal prerequisite:** drop plan with verification no external writer/reader still depends on it.

### `sku_rules`
- **Current status:** transitional historical schema artifact.
- **Evidence:** present in SQL migrations/seeds; canonical runtime uses `cpq_import_rows` + CPQ tables.
- **Removal prerequisite:** migration history policy decision (retain for replay vs squash/archive strategy).

## 5) Generated inventory artifacts

- `docs/generated/db-usage-report.md`
- `docs/database-runtime-inventory.json`
- `docs/database-runtime-inventory.md`

These are heuristic aids; this document remains the authoritative operational interpretation.
