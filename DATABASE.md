# DATABASE.md

## Purpose
This document is the **data/schema source of truth** for AppBikeConfig. It maps actual runtime usage (API + UI + services) to database objects from:
- `Database schema.csv`
- `Database constraints.csv`
- `sql/*.sql`
- runtime SQL in `app/api/*` and `lib/*`

> **Documentation convention (mandatory):** Any future code change that adds/changes/removes DB reads/writes must update this file and `PROCESSDATA.md` in the same change.

---

## 1) Object inventory and status

### 1.1 Canonical app tables (from CSV + runtime)

| Object | Status | Why |
|---|---|---|
| `app_users` | **Active** | auth, user management, feature/audit attribution. |
| `roles` | **Active** | role catalog for RBAC baseline. |
| `user_roles` | **Active** | user→role mapping used during session permission resolution. |
| `permissions` | **Active** | permission catalog and admin APIs. |
| `role_permissions` | **Active** | role baseline grants used at login/request auth. |
| `user_permissions` | **Active** | per-user allow/deny overrides. |
| `audit_log` | **Active (append-only)** | audit trail for most writes. |
| `feature_flags` | **Active** | runtime toggles (`import_csv_cpq`, `cpq_bdam_picture_picker`). |
| `feature_flag_audit` | **Active (append-only)** | feature toggle change history. |
| `cpq_import_rows` | **Active (canonical)** | Product - SKU definition canonical source + generation source rows. |
| `cpq_product_attributes` | **Active** | normalized product→canonical row links. |
| `cpq_products` | **Active (partly legacy payload columns)** | inserted by push; ID used by normalized model; many text columns now compatibility-only. |
| `cpq_products_flat` (view) | **Compatibility layer (active reads)** | CPQ matrix reads flattened attributes from normalized links. |
| `cpq_sku_rules` | **Active** | CPQ Sales matrix primary product rows + bc status + brake-mode uniqueness. |
| `cpq_countries` | **Active** | CPQ country list + brake mode classification. |
| `cpq_availability` | **Active** | CPQ SKU↔country availability matrix. |
| `cpq_product_assets` | **Active (feature-flag gated writes)** | CPQ picture picker persistence. |
| `sku_digit_option_config` | **Active** | digit metadata for Product Setup and generation constraints. |
| `sku_generation_dependency_rules` | **Active** | generation dependency constraints (currently `match_code`). |
| `role_permission_baselines_audit` | **Active (append-only)** | role baseline edits from Admin Users API. |

### 1.2 Legacy / transitional objects

| Object | Status | Notes |
|---|---|---|
| `sku_rules` | **Legacy but still referenced** | no active runtime APIs write/read for operations; still migration seed/backfill source and documented legacy path. |
| `cpq_import_runs` | **Partially used / migration-era runtime support** | generation GET endpoint still reads/updates run diagnostics; no active route in current repo creates runs. |
| `cpq_import_row_translations` | **Unused (candidate)** | table exists, no runtime code references. |

### 1.3 Non-CSV but still in schema/runtime (legacy matrix track)

| Object | Status | Notes |
|---|---|---|
| `products` | **Compatibility layer (active when CPQ flag OFF)** | used by `/api/matrix*` + legacy builder push. |
| `countries` | **Compatibility layer (active when CPQ flag OFF)** | legacy country list + add country API. |
| `availability` | **Compatibility layer (active when CPQ flag OFF)** | legacy SKU↔country matrix. |
| `setup_options` | **Legacy partially used** | has API route, but Product Setup page now uses `product-setup` tables; no primary UI path observed in nav. |

---

## 2) Field-level usage by table

Legend: **R** read, **W** write, **F** filter/join key, **UI** displayed, **L** legacy/backfill only.

## 2.1 Auth/RBAC

### `app_users`
- `id` (R/W/F/UI): FK target across auth/audit/flags/assets; session identity.
- `email` (R/W/F/UI): login lookup + admin display.
- `password_hash` (R/W): login verification, user create.
- `is_active` (R/W/UI): auth gate + activation toggle.
- `created_at` (R/UI): users list.
- `updated_at` (W): activation updates; not typically displayed.

### `roles`
- `id` (R/F): join target from `user_roles`.
- `role_key` (R/W/F/UI): canonical role identifier; FK target from `role_permissions`.
- `role_name` (R/UI): role display in API.

### `user_roles`
- `user_id` (R/W/F)
- `role_id` (R/W/F)

### `permissions`
- `id` (R/F)
- `permission_key` (R/W/F/UI)
- `permission_name` (R/W/UI)
- `description` (R/W/UI)
- `created_at` (L/passive)

### `role_permissions`
- `role_key` (R/W/F)
- `permission_id` (R/W/F)

### `user_permissions`
- `user_id` (R/W/F)
- `permission_id` (R/W/F)
- `granted` (R/W/UI semantics)
- `created_at`, `updated_at` (W/passive)

### `audit_log`
- `id` (implicit)
- `user_id` (W/R)
- `action_key` (W/R/F)
- `entity_type` (W/R/F)
- `entity_id` (W/R/F)
- `old_data`, `new_data` (W/R)
- `created_at` (R)

### `role_permission_baselines_audit`
- `id` (implicit)
- `role_key`, `permission_key`, `granted`, `changed_by`, `changed_at` (W only currently; no read API yet).

## 2.2 Feature flags

### `feature_flags`
- `id` (R)
- `flag_key` (R/F/UI)
- `flag_name` (R/UI)
- `description` (R/UI)
- `enabled` (R/W/UI)
- `updated_at` (R/W)
- `updated_by` (R/W/F)

### `feature_flag_audit`
- `feature_flag_id`, `flag_key`, `old_enabled`, `new_enabled`, `updated_by`, `updated_at` are append-written on flag changes.

## 2.3 CPQ canonical definition + generation

### `cpq_import_rows` (critical canonical table)
- `id` (R/W/F/UI): canonical reference ID used by generation and attribute links.
- `import_run_id` (R/W/F): nullable; used by generation GET by run scope.
- `row_number` (R/W): used for ordered run processing.
- `option_name` (R/W/F/UI)
- `choice_value` (R/W/F/UI)
- `digit_position` (R/W/F/UI)
- `code_value` (R/W/F/UI)
- `status` (R/W/F): `imported/skipped/error`.
- `reason` (L): present for diagnostics; no active writes in main UI flows.
- `raw_option_name`, `raw_digit`, `raw_code_value` (L): import diagnostics/backfill era.
- `normalized_option_name` (W/R): used for canonicalization/search consistency.
- `action_attempted` (W/R): diagnostics + source trace.
- `is_active` (R/W/F/UI): core active/inactive lifecycle.
- `deactivated_at`, `deactivation_reason` (R/W/UI)
- `updated_at`, `updated_by` (R/W)
- `source` (W/R): canonical source provenance.

### `cpq_import_runs` (partial)
- actively used in `/api/cpq/generate?run_id=...`: `id`, file/meta fields, phase/status/error timestamps.
- no in-repo route currently inserts new run rows; create-path appears external/removed.

### `sku_digit_option_config`
- `digit_position` (R/W/F/UI)
- `option_name` (R/W/UI)
- `is_required` (R/W/UI)
- `selection_mode` (R/W/UI)
- `is_active` (R/W/F/UI)
- `id`, timestamps mostly passive.

### `sku_generation_dependency_rules`
- `source_digit_position`, `target_digit_position` (R/W/F/UI)
- `rule_type` (R/W/F/UI)
- `active` (R/W/F/UI)
- `sort_order` (R/W/UI)
- `notes` (R/W/UI)
- `id`, timestamps passive.

## 2.4 CPQ product persistence and matrix

### `cpq_products`
- actively used columns:
  - `id` (R/W/F): anchor ID for normalized attributes and `cpq_sku_rules` FK.
  - `import_run_id` (W partial), `cpq_ruleset`, `brake_reverse`, `brake_non_reverse`, `sku_code`, `created_by`, `created_at`.
- **compatibility/legacy text payload columns** (many): `product_assist ... frontforkcolour`, `description`, `position29`, `position30`.
  - current push flow does **not** populate most of these directly; matrix reads equivalent values through `cpq_products_flat` via `cpq_product_attributes` + `cpq_import_rows`.
  - treat as legacy compatibility fallback fields.

### `cpq_product_attributes`
- `cpq_product_id` (R/W/F)
- `option_name` (R/W/F)
- `cpq_import_row_id` (R/W/F)
- `created_at`, `updated_at` passive/updated on conflict.

### `cpq_products_flat` view
- read-only compatibility projection combining `cpq_products` + normalized references.
- CPQ matrix GET depends on this for attribute columns.

### `cpq_sku_rules`
- `id` (R/W/F/UI)
- `cpq_product_id` (R/W/F)
- `sku_code`, `cpq_ruleset`, `brake_type` (R/W/F/UI; uniqueness key)
- matrix attribute columns used directly in edit flows: `bike_type`, `handlebar`, `speed`, `rack`, `colour`, `light`, `seatpost_length`, `saddle`, `description`.
- `bc_status` (R/W/UI)
- lifecycle columns: `is_active` (R/F), `deactivated_at`, `deactivation_reason` (mostly passive)
- audit/user columns: `created_by`, `created_at`, `updated_at`.

### `cpq_countries`
- `id`, `country`, `region`, `brake_type` active read/filter; writes happen via seeds/migrations, not runtime API currently.
- timestamps passive.

### `cpq_availability`
- `cpq_sku_rule_id`, `cpq_country_id` (R/W/F)
- `available` (R/W/UI)
- `updated_at` (W/passive)

### `cpq_product_assets`
- `cpq_sku_rule_id` (R/W/F unique)
- `asset_url` (R/W/UI)
- `png_url`, `asset_id`, `notes` (R/W/UI)
- `selected_by`, `selected_at`, `updated_by`, `updated_at` (R/W)
- `id` passive.

## 2.5 Legacy matrix path (feature flag OFF)

### `products`, `countries`, `availability`
- actively used in `/api/matrix*` + `/api/builder-push` when CPQ mode off.
- many columns mirror CPQ schema (`sku_code`, attributes, `bc_status`, etc.).
- long-term role is compatibility path.

### `setup_options`
- has CRUD API, but primary setup UI now uses `sku_digit_option_config` + `sku_generation_dependency_rules`.
- likely legacy/secondary.

### `sku_rules`
- deprecated operationally; still exists for backfill/migration logic and tests asserting canonical shift.

### `cpq_import_row_translations`
- no runtime usage found.

---

## 3) Constraints, indexes, and relationship analysis

## 3.1 High-value integrity constraints currently relied on

1. **`cpq_import_rows_active_structural_uniq`** (migration 013): one active canonical row per structural key `(digit_position, option_name, code_value)`.
   - protects SKU definition uniqueness and clean option catalogs.
   - runtime logic also pre-checks duplicates before insert/reactivate.

2. **`cpq_product_attributes_product_option_uniq`**: one attribute link per product+option.
   - push flow depends on upsert semantics to keep latest reference.

3. **`cpq_sku_rules_active_unique`**: unique active `(sku_code, cpq_ruleset, brake_type)`.
   - matrix upsert/push pre-check and DB both enforce duplicate prevention.

4. **`cpq_availability` composite PK** `(cpq_sku_rule_id, cpq_country_id)`.
   - enables idempotent upsert for matrix bulk/single saves.

5. **`feature_flags.flag_key` unique**.
   - required for deterministic flag toggles.

6. **RBAC FK graph**:
   - `user_roles`→`app_users`,`roles`
   - `role_permissions`→`roles.role_key`,`permissions`
   - `user_permissions`→`app_users`,`permissions`
   - authentication/authorization pipeline depends on this consistency.

7. **Check constraints**:
   - brake types (`cpq_countries`, `cpq_sku_rules`), BC status checks, digit/rule bounds, rule types.
   - code validates many of these too, but DB is still the authoritative guardrail.

## 3.2 Constraints to review for drift risk

- `cpq_import_rows_option_choice_uniq` (migration 010) and later active structural uniqueness can conflict conceptually with repeated values across digit contexts if option naming normalization evolves.
- `cpq_import_runs` required columns remain strict though create flow appears absent in current runtime.
- legacy tables (`sku_rules`, `setup_options`, `products/*`) retain constraints but are only compatibility-path critical.

## 3.3 Relationship risk points

- `cpq_sku_rules.cpq_product_id` with `ON DELETE SET NULL`: deleting `cpq_products` can orphan matrix rows; code currently deletes freshly inserted product on duplicate rule detection as rollback behavior.
- `cpq_product_attributes.cpq_import_row_id ON DELETE RESTRICT`: intentionally blocks deleting canonical rows still linked to generated products.
- `role_permission_baselines_audit` not present in provided CSV exports: schema/documentation drift indicator.

---

## 4) Likely cleanup/deprecation candidates (documentation-only recommendation)

1. `cpq_import_row_translations` (unused in runtime).
2. `setup_options` path (if confirmed no business users rely on legacy page/api).
3. `sku_rules` (after confirming all backfill/migration reliance is retired).
4. legacy matrix tables `products/countries/availability` and routes if CPQ flag becomes permanent ON.
5. many textual payload columns on `cpq_products` once full normalized read path is institutionalized and historical exports no longer require fallback.

---

## 5) Certainty levels

- **High certainty**: usage classifications for objects referenced by runtime SQL in `app/api/*` and `lib/*`.
- **Medium certainty**: “unused” classification for objects with no in-repo SQL references (`cpq_import_row_translations`) but potentially queried externally.
- **Medium certainty**: cleanup readiness for legacy matrix objects because feature flag still supports fallback mode.

