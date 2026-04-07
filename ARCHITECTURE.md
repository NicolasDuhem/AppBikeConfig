# AppBikeConfig Architecture

## 1) Canonical CPQ data model

### 1.1 Single source for Product - SKU definition
`cpq_import_rows` is now the **only** canonical source for Product ↔ SKU definition values and wording.

`sku_rules` is deprecated and not used by active application logic.

Canonical row lifecycle fields on `cpq_import_rows`:
- `is_active`
- `deactivated_at`
- `deactivation_reason`
- `updated_at`
- `updated_by`
- `source`

### 1.2 Normalized product references
- `cpq_products` = product identity + SKU code.
- `cpq_product_attributes` = product-to-canonical reference bridge (`cpq_import_row_id`).
- `cpq_products_flat` = read compatibility layer/view for downstream display.

This keeps wording normalized: if a canonical row wording changes, all consumers that resolve via `cpq_product_attributes -> cpq_import_rows` update automatically.

---

## 2) Page/data-flow mapping

### 2.1 Product - SKU definition
- API: `app/api/sku-rules/route.ts`.
- Reads from `cpq_import_rows where status='imported'`.
- Add/Edit/Inactivate/Reactivate/Delete act directly on canonical `cpq_import_rows`.
- Delete is blocked if `cpq_product_attributes` references the row.

### 2.2 Product - Create SKU
- Option source: `GET /api/cpq/options` reads active canonical rows from `cpq_import_rows`.
- Generator: `GET /api/cpq/generate` resolves active canonical scope from `cpq_import_rows`.
- Push: persists normalized references into `cpq_product_attributes` using canonical `cpq_import_row_id`.

### 2.3 Sales - SKU vs Country
Sales matrix continues to read generated products; wording consistency is preserved through normalized references in `cpq_products_flat`/`cpq_product_attributes`.

### 2.4 Product - Setup
`/api/product-setup` now discovers available digits from active canonical `cpq_import_rows`, not `sku_rules`.

---

## 3) RBAC model and standard role base management

### 3.1 RBAC tables
- `roles`
- `user_roles`
- `permissions`
- `role_permissions` (baseline role-to-permission mapping)
- `user_permissions` (per-user allow/deny override)

### 3.2 New baseline management capability
Sys admins can now manage the standard role base mapping from Admin - Users via `app/api/role-permissions/route.ts`:
- `GET`: list role baseline grants.
- `PATCH`: replace baseline permissions for a role.

Baseline changes are audited in:
- `role_permission_baselines_audit`

---

## 4) Migration and backfill strategy

Migration file: `sql/013_cpq_import_rows_canonical_and_role_baseline.sql`

What it does:
1. Adds canonical lifecycle fields to `cpq_import_rows`.
2. Backfills missing canonical rows from legacy `sku_rules` (without duplicates).
3. Auto-deactivates duplicate active canonical structural keys.
4. Adds unique/index guards for active structural keys.
5. Adds `role_permission_baselines_audit` table.

Structural uniqueness is enforced on active canonical keys by:
- `digit_position`
- `option_name`
- `code_value`

---

## 5) UI/layout principles (compact desktop admin)

Applied across Product - SKU definition, Product - Create SKU, Product - Setup, and Admin - Users:
- compact toolbar/card spacing
- table-first layout
- internal table scroll containers (`.tableWrap`) with bounded heights
- avoid forcing full-page vertical scrolling for operational grids

Product - Setup now explicitly uses bounded table containers to keep dependency/config tables internally scrollable in realistic desktop viewport sizes.

---

## 6) Acceptance-state architecture

### Active architecture
- `cpq_import_rows` (canonical source values/IDs)
- `cpq_product_attributes` (product ↔ canonical reference bridge)
- `cpq_products` (product identity)
- `cpq_products_flat` (compat/read view)
- role/permission tables + baseline management API
- setup/configuration tables (`sku_digit_option_config`, `sku_generation_dependency_rules`)

### Deprecated from active logic
- `sku_rules` as an operational source for Product - SKU definition or Product - Create SKU
