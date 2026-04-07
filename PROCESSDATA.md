# PROCESSDATA.md

## Purpose
This document is the **process/data-flow source of truth** for AppBikeConfig.

> **Documentation convention (mandatory):** Every future feature or behavior change that impacts DB reads/writes must update both `DATABASE.md` (schema/data model impact) and `PROCESSDATA.md` (flow impact).

---

## 1) Process map (top-level)

1. Authentication and permission resolution
2. Feature-flag resolution and admin flag management
3. User and role baseline management
4. Product - SKU definition lifecycle (canonical `cpq_import_rows`)
5. Product - Setup configuration (`sku_digit_option_config`, dependency rules)
6. Product - Create SKU generation and push (normalized CPQ model)
7. Sales - SKU vs Country (CPQ matrix)
8. Legacy matrix compatibility path (flag OFF)
9. BigCommerce status check
10. CPQ picture picker attachment flow
11. Migration/backfill context that still affects runtime understanding

---

## 2) Authentication / authorization

### Diagram-friendly block
- **Trigger:** Login form submit (`/login`) or any protected API/page request.
- **Preconditions:** user exists in `app_users`, active status true.
- **Steps:**
  1. Credentials validated (`email`, `password_hash`).
  2. Session user resolved by email.
  3. Roles loaded through `user_roles`→`roles`.
  4. Permission set built from `role_permissions` + `permissions` plus `user_permissions` overrides.
  5. API guard (`requireApiLogin` / `requireApiRole`) enforces action.
- **Tables read:** `app_users`, `user_roles`, `roles`, `role_permissions`, `permissions`, `user_permissions`.
- **Tables written:** none (except when admin updates users/permissions via separate flows).
- **Key fields:** `app_users.is_active`, `roles.role_key`, `permissions.permission_key`, `user_permissions.granted`.
- **Outputs:** session identity + effective permissions.
- **Failure points:** invalid credentials, inactive user, missing permission.

---

## 3) Feature flag management

### A) Public feature flag resolution (runtime gating)
- **Trigger:** UI boot for nav/pages (`/api/feature-flags/public`).
- **Reads:** `feature_flags.enabled` by `flag_key`; current user roles/permissions via auth flow.
- **Writes:** none.
- **Output:** `import_csv_cpq`, `cpq_bdam_picture_picker`, and caller permissions.

### B) Admin feature flag update
- **Trigger:** Admin - Feature flag page PATCH.
- **Writes:**
  - `feature_flags.enabled`, `updated_at`, `updated_by`
  - append `feature_flag_audit` row (`old_enabled`, `new_enabled`, `updated_by`)
- **Reads:** existing flag row to diff old/new.
- **Validation:** `flag_key` required, row must exist.

---

## 4) User / role / permission baseline management

### Diagram-friendly block
- **Trigger:** Admin - Users page actions.
- **Preconditions:** caller has `users.manage`; for overrides/baseline `permissions.manage`.
- **Steps:**
  1. GET lists users + role memberships + per-user overrides.
  2. Create user inserts `app_users` then inserts `user_roles` from selected `role_key`s.
  3. Role edits replace `user_roles` rows for a user.
  4. Activation toggle updates `app_users.is_active`.
  5. Permission override save replaces `user_permissions` rows.
  6. Role baseline save replaces `role_permissions` for a role and appends `role_permission_baselines_audit` entries.
  7. Audits written to `audit_log` for major user actions.
- **Tables read:** `app_users`, `roles`, `permissions`, `user_roles`, `user_permissions`, `role_permissions`.
- **Tables written:** `app_users`, `user_roles`, `user_permissions`, `role_permissions`, `role_permission_baselines_audit`, `audit_log`.
- **Key updated fields:**
  - `app_users.password_hash`, `is_active`, `updated_at`
  - `user_roles.user_id/role_id`
  - `user_permissions.granted`, `updated_at`
  - `role_permissions.role_key/permission_id`
- **Outputs:** effective access model used immediately by API guards.
- **Failure points:** invalid role/permission keys, missing permissions.

---

## 5) Product - SKU definition lifecycle (canonical)

### Diagram-friendly block
- **Trigger:** `Product - SKU definition` page (`/sku-definition`) via `/api/sku-rules`.
- **Preconditions:** auth; writes require `sku.manage` or `sku.delete`.
- **Steps:**
  1. GET reads canonical rows from `cpq_import_rows` (`status='imported'`) with optional inactive rows.
  2. POST inserts canonical row (manual source), enforcing duplicate and code format checks.
  3. PATCH(edit) updates only `choice_value` + update metadata.
  4. PATCH(activate/deactivate) toggles `is_active`, deactivation fields, duplicate-reactivation guard.
  5. DELETE removes row only when no `cpq_product_attributes` references.
  6. All mutations append `audit_log` entries.
- **Tables read:** `cpq_import_rows`, `cpq_product_attributes`, `audit_log`, `app_users`.
- **Tables written:** `cpq_import_rows`, `audit_log`.
- **Fields updated:** `choice_value`, `is_active`, `deactivated_at`, `deactivation_reason`, `updated_at`, `updated_by`, `source` (on create).
- **Constraints/validations:** active structural uniqueness, alphanumeric code rules, no delete when referenced.
- **Outputs:** canonical definition options used by setup and generation.

---

## 6) Product - Setup configuration

### Diagram-friendly block
- **Trigger:** `/setup` page reads/writes `/api/product-setup`.
- **Reads:**
  - `sku_digit_option_config`
  - `sku_generation_dependency_rules`
  - available active digits from `cpq_import_rows`
- **Writes (PATCH):**
  - upsert `sku_digit_option_config`
  - full replace of `sku_generation_dependency_rules` then upserts incoming rules
- **Updated fields:** required/selection mode/active per digit; dependency `source_digit_position`, `target_digit_position`, `rule_type`, `active`, `sort_order`, `notes`.
- **Output:** generation behavior metadata consumed by `/api/cpq/options` and `/api/cpq/generate`.
- **Failure points:** invalid digit/rule ranges and check constraints.

---

## 7) Product - Create SKU generation

## 7.1 Options hydration
- **Trigger:** CPQ feature page load -> `/api/cpq/options`.
- **Reads:** active canonical `cpq_import_rows`; active setup config and dependency rules.
- **Output:** selectable digit options + product-level options.

## 7.2 Generation execution (`POST /api/cpq/generate`)
- **Input:** CPQ ruleset + product meta + selected digit choices with optional canonical row IDs.
- **Reads:** `sku_digit_option_config`, `sku_generation_dependency_rules`.
- **In-memory processing:** validates required digits, single/multi rules, dependency constraints, then produces generated rows with `__refs` map.
- **Writes:** none.

## 7.3 Legacy run-scoped generation diagnostics (`GET /api/cpq/generate?run_id=`)
- **Reads:** `cpq_import_runs`, `cpq_import_rows`.
- **Writes:** updates `cpq_import_runs.current_phase/status/error/completed_at/failed_at`.
- **Notes:** still active but appears tied to import-run path not fully present in current routes.

---

## 8) Push selected generated products to Sales (CPQ path)

### Diagram-friendly block
- **Trigger:** CPQ feature page “Push selected”.
- **Preconditions:** `builder.push`, non-empty selected rows, valid `brakeMode`.
- **Steps per row:**
  1. Deduplicate against request-local repeated SKU.
  2. Check `cpq_products` for existing `sku_code`; skip duplicates.
  3. Insert `cpq_products` baseline row.
  4. Build attribute entries; resolve/create canonical `cpq_import_rows` references.
  5. Upsert `cpq_product_attributes` for product-option links.
  6. Check active duplicate in `cpq_sku_rules` on `(sku_code, cpq_ruleset, brake_type)`.
  7. If duplicate found: delete just-inserted `cpq_products` row (rollback behavior) and skip.
  8. Insert `cpq_sku_rules` row.
  9. Seed `cpq_availability` rows for all `cpq_countries` as `available=false`.
- **Tables read:** `cpq_products`, `cpq_import_rows`, `cpq_sku_rules`, `cpq_countries`.
- **Tables written:** `cpq_products`, `cpq_import_rows` (reference rows when missing), `cpq_product_attributes`, `cpq_sku_rules`, `cpq_availability`.
- **Outputs:** CPQ matrix rows now available in Sales - SKU vs Country.

---

## 9) Sales - SKU vs Country (CPQ matrix)

### 9.1 Matrix load (`GET /api/cpq-matrix`)
- **Reads:** `cpq_countries`, `cpq_sku_rules` active rows, `cpq_products_flat` view, `cpq_product_assets`, `cpq_availability`.
- **Writes:** none.
- **Output:** editable grid rows + availability map + ruleset filters.

### 9.2 Single/batch save (`POST /api/cpq-matrix` / `save-all`)
- **Writes:** upsert `cpq_sku_rules` product fields + upsert `cpq_availability` per country.
- **Validations:** required `sku_code`, `cpq_ruleset`, valid `brake_type`, active duplicate guard, brake mismatch block for country assignment.
- **Audit:** `audit_log` entries for single and batch.

### 9.3 Bulk country update (`POST /api/cpq-matrix/bulk-update`)
- **Reads:** target `cpq_countries` brake type, selected/all active `cpq_sku_rules`.
- **Writes:** upsert `cpq_availability.available`.
- **Decision point:** if enabling availability and brake mismatch, row blocked (counted in response).

### 9.4 BigCommerce status check (`POST /api/cpq-matrix/check-bc-status`)
- **Reads:** external BigCommerce API + input row list.
- **Writes:** `cpq_sku_rules.bc_status` for persistable successful lookups.
- **Audit:** summary logged in `audit_log`.

### 9.5 Picture picker (`POST /api/cpq-matrix/picture`)
- **Precondition:** feature flag `cpq_bdam_picture_picker` enabled.
- **Reads:** validates active `cpq_sku_rules` row; existing `cpq_product_assets` for oldData.
- **Writes:** upsert `cpq_product_assets` fields and selector metadata; audit appended.

---

## 10) Legacy compatibility flows (feature flag OFF)

1. `/matrix*` routes use `products`, `countries`, `availability`.
2. `/builder-push` writes `products` and seeds `availability`.
3. `/countries` writes legacy `countries`.
4. `setup-options` route still exists for `setup_options` CRUD.

These are active only in legacy mode and represent deprecation candidates once CPQ path is fully mandatory.

---

## 11) Migration/backfill flows that still matter for runtime understanding

- Migration 010 established normalized links (`cpq_product_attributes`) and compatibility view (`cpq_products_flat`).
- Migration 013 moved canonical SKU definition authority to `cpq_import_rows`, added lifecycle fields, and active structural uniqueness.
- Backfill logic from `sku_rules` and old `cpq_products` columns explains why several legacy columns/tables still exist.

---

## 12) Recommended cleanup sequence (documentation-first)

1. Confirm production usage of legacy `/matrix` + `/builder-push` + `/setup-options` APIs.
2. If unused, mark compatibility tables as deprecated in code/docs and add runtime telemetry.
3. Remove reliance on `cpq_import_runs` if import-run flow is permanently retired.
4. Decide fate of `cpq_import_row_translations` (implement or drop).
5. Simplify `cpq_products` by removing no-longer-needed text payload columns after export/report consumers are migrated.

