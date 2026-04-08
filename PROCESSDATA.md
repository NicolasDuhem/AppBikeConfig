# PROCESSDATA.md

## Purpose

Detailed process/data-flow reference for the **current CPQ-only runtime**.

This document is optimized for:
- operational debugging,
- future feature work,
- cleanup/removal planning,
- explicit read/write + validation + failure-path clarity.

Date reconciled: **April 8, 2026**.

---

## 1) End-to-end process map

1. User authenticates and RBAC context is resolved.
2. Canonical CPQ options are maintained (`/api/sku-rules`).
3. Locale translations are maintained (`/api/sku-rule-translations`).
4. Setup constraints are maintained (`/api/product-setup`).
5. Builder hydrates options (`/api/cpq/options`).
6. User generates combinations (`/api/cpq/generate` POST).
7. User pushes selected rows (`/api/cpq/push`).
8. Sales matrix is read/edited (`/api/cpq-matrix*`).
9. Optional picture metadata writes occur (`/api/cpq-matrix/picture`) when flag-enabled.

---

## 2) Process detail by endpoint family

## 2.1 Authentication and authorization

### Trigger
- Login attempts and guarded API calls.

### Entry points
- `/api/auth/[...nextauth]`, `lib/auth.ts`, `lib/api-auth.ts`.

### Permissions/auth
- Login validates active credentialed users.
- Endpoint-level guards call `requireApiLogin` or `requireApiRole(permission_key)`.

### Tables read
- `app_users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `user_permissions`.

### Tables written
- None in standard credential verification flow.

### Outputs
- Session principal + effective permissions.
- 401/403 on denied access.

### Failure points
- Invalid credentials.
- Inactive user.
- Missing role/permission grants.

---

## 2.2 Feature flag context and administration

### A) `/api/feature-flags/public`
- **Trigger:** app shell/nav context bootstrap.
- **Reads:** `feature_flags` + RBAC lookup tables.
- **Writes:** none.
- **Outputs:** flag map + permission/role envelope used for UI visibility.
- **Failure points:** auth/RBAC failures.

### B) `/api/feature-flags`
- **Trigger:** admin updates to flags.
- **Permission:** `feature_flags.manage`.
- **Reads:** existing flag row/user metadata.
- **Writes:** `feature_flags`, `feature_flag_audit`.
- **Validation:** known flag keys, actor identity, value coercion.
- **Output:** updated flag state.
- **Failure points:** permission denial, invalid payload.

Runtime note:
- `cpq_bdam_picture_picker` is actively used.
- `import_csv_cpq` is no longer a runtime branch selector.

---

## 2.3 SKU definition lifecycle (`/api/sku-rules`)

### Trigger
- Product definition CRUD from SKU Definition UI.

### Permissions/auth
- `GET`: authenticated user.
- `POST/PATCH`: `sku.manage`.
- `DELETE`: `sku.delete`.

### Reads
- `cpq_import_rows` for canonical rows.
- `audit_log` + `app_users` for “last edited by” metadata.
- `cpq_product_attributes` for delete-reference protection.

### Writes
- `cpq_import_rows` inserts/updates/deletes.
- `audit_log` for create/edit/activate/deactivate/delete events.

### Key field updates
- `choice_value` edit path.
- `is_active`, `deactivated_at`, `deactivation_reason` lifecycle path.
- `updated_at`, `updated_by` provenance.

### Validations
- Required fields (`option_name`, `code_value`, `choice_value`).
- `digit_position` constraints and code-format rules.
- Digit-to-option-name consistency.
- Active duplicate prevention by business key.
- Deletion blocked if referenced in `cpq_product_attributes`.

### Outputs
- Canonical rows, digit issue diagnostics, conflict errors.

### Failure points
- Duplicate active rows.
- Invalid code value/digit semantics.
- Deletion of referenced rows.

---

## 2.4 Translation management (`/api/sku-rule-translations`)

### Trigger
- Locale-specific label edits.

### Permissions/auth
- `GET`: authenticated user.
- `PATCH`: `sku.manage`.

### Reads
- `cpq_import_rows`.
- `cpq_import_row_translations`.
- `cpq_countries` (managed locales).
- `app_users` (translation-updated attribution on GET).

### Writes
- Upsert/delete in `cpq_import_row_translations`.
- `audit_log` translation batch events.

### Key field updates
- `translated_value` per `(cpq_import_row_id, locale)`.
- `updated_at`, `updated_by` on translation changes.

### Validations
- Locale must be managed in `cpq_countries.locale_code`.
- Row IDs must belong to canonical imported rows.
- Empty translation clears row-locale value.

### Outputs
- Locale-scoped translation snapshot and patch result (`saved`, `cleared`).

### Failure points
- Unsupported locale.
- Invalid/unknown row IDs.

---

## 2.5 Product setup configuration (`/api/product-setup`)

### Trigger
- Setup screen load/save.

### Permissions/auth
- `GET`: `builder.use`.
- `PATCH`: `setup.manage`.

### Reads
- `sku_digit_option_config`.
- `sku_generation_dependency_rules`.
- Active digit context from `cpq_import_rows`.

### Writes
- Upsert into `sku_digit_option_config` keyed by `digit_position`.
- Full replace pattern for `sku_generation_dependency_rules` (delete then insert/upsert).

### Key field updates
- Required/single-multi behavior per digit.
- Dependency graph ordering/activation/notes.

### Validations
- Digit range 1..30.
- Option naming presence.
- Rule tuples with valid source/target digits.

### Outputs
- Current setup model for builder.

### Failure points
- Permission denial.
- Invalid payload structure.

---

## 2.6 CPQ options hydration (`/api/cpq/options`)

### Trigger
- Builder load and locale/country changes.

### Permissions/auth
- `builder.use`.

### Reads
- Active `cpq_import_rows`.
- `cpq_import_row_translations` joined by resolved locale.
- `sku_digit_option_config`.
- `sku_generation_dependency_rules`.
- `cpq_countries` through runtime locale resolution.

### Writes
- None.

### Locale resolution sequence
1. Explicit `locale` query if managed.
2. Locale from country context (`country_id`/name lookup in `cpq_countries`).
3. Managed default fallback (`en-US` when unavailable).

### Outputs
- Product field options.
- Digit option groups with code/choice payload.
- Active dependency rules.
- Locale metadata (`locale`, source, managed locales).

### Failure points
- Permission/auth failure.
- Empty option sets due to canonical data issues.

---

## 2.7 Combination generation (`/api/cpq/generate`)

### A) POST (primary path)
- **Trigger:** user generation request.
- **Permission:** `builder.use`.
- **Reads:** setup tables only (`sku_digit_option_config`, `sku_generation_dependency_rules`) + request payload.
- **Writes:** none.
- **Validations:**
  - required product fields,
  - required-digit coverage,
  - single/multi compliance,
  - dependency rule compatibility (`match_code`).
- **Output:** generated rows with reference metadata.
- **Failure points:** invalid payload/config conflicts.

### B) GET `?run_id=` (transitional diagnostics)
- **Trigger:** diagnostics/reconciliation for historical import-run flow.
- **Permission:** `builder.use`.
- **Reads/Writes:** `cpq_import_runs` phase/status and scoped reads from `cpq_import_rows`.
- **Outputs:** generation diagnostics + phased status.
- **Failure points:** missing/unknown run ID, generation errors, phase-update errors.

---

## 2.8 Push flow (`/api/cpq/push`)

### Trigger
- User pushes selected generated combinations.

### Permissions/auth
- `builder.push`.

### Reads
- Existing `cpq_products` duplicate check.
- `cpq_import_rows` for canonical reference resolution/backfill lookup.
- `cpq_sku_rules` active duplicate check.
- `cpq_countries` to seed availability rows.

### Writes
- `cpq_products` insert.
- `cpq_product_attributes` upsert.
- Optional `cpq_import_rows` insert for missing reference attributes.
- `cpq_sku_rules` insert.
- `cpq_availability` insert/upsert for all countries.

### Key field updates
- Product-level brake flags (`brake_reverse`, `brake_non_reverse`).
- Rule-level brake type (`reverse`/`non_reverse`).
- Availability defaults (`false`) per country.

### Validations
- Required request payload (`rows`, `brakeMode`).
- Duplicate SKU handling (in-request and persisted).
- Row-level reference resolution for attributes.

### Outputs
- Push summary: `pushed`, skipped duplicates, failed rows.

### Failure points
- Duplicate SKU collisions.
- Missing canonical references.
- Partial failures creating availability rows.

---

## 2.9 CPQ matrix lifecycle (`/api/cpq-matrix*`)

### A) `/api/cpq-matrix` GET
- **Trigger:** Sales matrix screen load/refresh.
- **Permission:** authenticated login.
- **Reads:** `cpq_sku_rules`, `cpq_products_flat`, `cpq_availability`, `cpq_countries`, optional `cpq_product_assets`.
- **Writes:** none.
- **Output:** rows, rulesets, countries, availability map.

### B) `/api/cpq-matrix` POST and `/save-all`
- **Trigger:** single-row or batched row edits.
- **Permission:** `matrix.update.single`.
- **Reads/Writes:** through `lib/cpq-matrix-service.ts` to `cpq_sku_rules`, `cpq_availability`, `cpq_countries`.
- **Validation:**
  - required `sku_code`/`cpq_ruleset`/`brake_type`,
  - active duplicate checks,
  - brake compatibility with country before availability assignment.
- **Audit:** `audit_log` records old/new state or batch outcome.

### C) `/api/cpq-matrix/bulk-update`
- **Trigger:** assign/unassign selected country across many rows.
- **Permission:** `matrix.update.bulk`.
- **Reads:** target country and active rules.
- **Writes:** `cpq_availability` upsert.
- **Validation:** blocks incompatible brake-type assignments when setting available=true.
- **Output:** updated count + blocked count.

### D) `/api/cpq-matrix/check-bc-status`
- **Trigger:** BigCommerce validation action.
- **Permission:** matrix update roles.
- **Reads:** local rule rows + external BC API.
- **Writes:** `cpq_sku_rules.bc_status`.
- **Failure points:** external BC errors and partial-check outcomes.

### E) `/api/cpq-matrix/picture`
- **Trigger:** picture picker save.
- **Permission:** `matrix.update.single`.
- **Feature gate:** `cpq_bdam_picture_picker`.
- **Reads:** `feature_flags`, target `cpq_sku_rules`, existing `cpq_product_assets` row.
- **Writes:** upsert `cpq_product_assets`; writes `audit_log`.

---

## 3) Historical/non-runtime context retained for cleanup planning

Explicitly retired runtime APIs: `/api/matrix*`, `/api/builder-push`, `/api/countries`, `/api/setup-options`.

Schema-history objects still relevant to cleanup planning:
- `products`, `countries`, `availability`, `setup_options` (legacy baseline definitions).
- `sku_rules` (still physically present in some schemas but not active runtime table).

These objects should be treated as **retirement planning inputs**, not runtime process dependencies.

---

## 4) Process-level cleanup implications

1. No active process depends on legacy matrix-era tables.
2. Transitional risk centers on `cpq_import_runs` diagnostics and residual `sku_rules` presence.
3. Most cleanup risk is external-dependency uncertainty, not in-repo runtime coupling.

See `docs/database-cleanup-recommendations.md` for sequenced drop/retire actions.
