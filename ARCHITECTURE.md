# AppBikeConfig Architecture

## 1) Overview
AppBikeConfig is Brompton’s internal SKU configuration and market-allocation system. It now uses a **role + explicit permission** model and a **config-driven SKU generation engine** (required digits, selection mode, dependency rules).

Core goals:
- keep normalized CPQ references intact (`cpq_import_rows` -> `cpq_product_attributes`)
- avoid hard-coded SKU generation rules
- enforce authorization in backend + frontend for all sensitive actions

---

## 2) Security and authorization model

### 2.1 Role baseline + permission capability layer
- `roles` and `user_roles` still define baseline access groups.
- New `permissions` master table defines capabilities (`permission_key`).
- `role_permissions` maps baseline permissions to each role.
- `user_permissions` supports explicit per-user overrides:
  - `granted = true` => force allow
  - `granted = false` => force deny
  - missing row => inherit from role baseline

### 2.2 Effective permission resolution
At login/API time:
1. Resolve user roles.
2. Load permissions granted by role mappings.
3. Apply `user_permissions` overrides.
4. Effective granted permissions are used by `requireApiRole(...)`.

### 2.3 Page/action authorization
- **Product - SKU definition delete**: `sku.delete` (baseline mapped to `sys_admin` + `product_admin`).
- **Admin - Users + permission override editing**: UI restricted to `sys_admin`; override API path also requires `permissions.manage`.
- **Product - Setup**: `setup.manage`.
- **Feature flags**: `feature_flags.manage`.

---

## 3) Product - SKU definition (delete behavior)

### 3.1 Lifecycle actions
- Add/edit/deactivate/reactivate still use `sku.manage`.
- New **permanent delete** action uses `DELETE /api/sku-rules?id=...` and requires `sku.delete`.

### 3.2 Referential safety
Delete is blocked when the SKU definition is already referenced through normalized generated products:
- checks matching `cpq_import_rows` by digit/option/code
- joins to `cpq_product_attributes`
- if references exist, API returns `409` with a clear message

No silent data corruption is allowed.

---

## 4) Product - Setup configuration model

### 4.1 `sku_digit_option_config`
Per digit (1..30), configurable behavior:
- `is_required` (true/false)
- `selection_mode` (`single` or `multi`)
- `is_active`

### 4.2 `sku_generation_dependency_rules`
Configurable dependency/forced-match rules:
- `source_digit_position`
- `target_digit_position`
- `rule_type` (currently `match_code`)
- `active`
- `sort_order`

Examples seeded by migration:
- Digit 5 -> Digit 27 (`match_code`)
- Digit 6 -> Digits 25/26/28 (`match_code`)

No digit-specific hard-coded business logic is used in code.

---

## 5) Product - Create SKU generation engine

### 5.1 Input loading
`GET /api/cpq/options` now returns:
- product field options
- digit option groups
- per-digit config flags (`isRequired`, `selectionMode`)
- active dependency rules

### 5.2 Generation rules
`POST /api/cpq/generate` now enforces:
- required digit validation
- single-select validation for `selection_mode = single`
- dependency constraints (`match_code`) that remove invalid cross-combinations

This is config-table driven; no hard-coded Main/Rear frame logic in the generator.

---

## 6) UI architecture updates

### 6.1 Product - SKU definition
- table viewport and wrapper are now flex-constrained for reliable vertical scroll.
- permanent delete action has:
  - conditional visibility (permission based)
  - irreversible confirmation modal
  - success/error feedback

### 6.2 Admin - Users
- still `sys_admin` managed.
- role assignment remains baseline control.
- new per-user permission override panel supports `inherit / allow / deny` by permission key.

### 6.3 Product - Setup (new operational setup page)
- manages digit required/single-vs-multi configuration.
- manages dependency rules (`match_code`) with order and active flags.

### 6.4 Product - Create SKU filter UX improvements
- cleaner reset actions for option selections and generated filters.
- searchable filter-column list for large generated-column sets.
- digit selector reflects required/optional + single/multi behavior.

---

## 7) Data model additions

New tables:
- `permissions`
- `role_permissions`
- `user_permissions`
- `sku_digit_option_config`
- `sku_generation_dependency_rules`

SQL delivered in:
- migration: `sql/012_permissions_and_sku_generation_config.sql`
- base schema extension: `sql/schema.sql`
- seed defaults: `sql/seed.sql`

---

## 8) End-to-end flow summary

1. Admin configures Product - Setup digit behavior + dependencies.
2. Product - Create SKU loads those configs and validates user selections.
3. Generator produces only valid combinations constrained by rules.
4. Push flow continues writing normalized product identity + attribute references.
5. SKU definition deletion is permanent but blocked when referenced.
