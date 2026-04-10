# Constraint cleanup candidates (CSV truth + runtime reconciliation)

Date: April 8, 2026.

## Keep (required / safety-critical)

- CPQ FK chain (`cpq_availability`, `cpq_product_attributes`, `cpq_import_row_translations`)
- Domain checks (`brake_type`, `bc_status`, import `status`, setup rule checks)
- Business unique constraints (active CPQ SKU uniqueness, row+locale uniqueness)

## Candidate cleanup (staged)

## 1) `sku_rules` constraint family
All constraints and indexes on `sku_rules` become removable after:
1. seed/migration dependency removal,
2. external dependency verification window,
3. controlled drop migration.

## 2) Redundant export-level NOT NULL check rows
CSV exports NOT NULL as CHECK entries; these are frequently mechanical.
Action: only remove if proven redundant and not relied on by tooling.

## Explicit non-goals

- Do not remove CPQ integrity constraints to simplify migration.
- Do not relax FK rules that enforce delete protections.
