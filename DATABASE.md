# DATABASE.md

## Purpose

Operational database truth for AppBikeConfig, reconciled against:
- `database schema.csv` (**authoritative schema truth for this run**)
- `database constraints.csv` (**authoritative constraints truth for this run**)
- runtime SQL in `app/**` + `lib/**`
- repository SQL in `sql/**` (explicitly non-authoritative when conflicting)

Date reconciled: **April 8, 2026**.

---

## 1) Real DB truth summary (CSV)

- 21 tables
- 210 columns
- 210 exported constraint rows
  - CHECK: 134
  - PRIMARY KEY: 33
  - FOREIGN KEY: 27
  - UNIQUE: 16

Table families:
- RBAC/Auth/Audit: `app_users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `user_permissions`, `audit_log`
- CPQ canonical/config: `cpq_import_rows`, `cpq_import_row_translations`, `sku_digit_option_config`, `sku_generation_dependency_rules`
- CPQ persistence/matrix: `cpq_products`, `cpq_product_attributes`, `cpq_sku_rules`, `cpq_availability`, `cpq_countries`, `cpq_product_assets`
- Feature/ops: `feature_flags`, `feature_flag_audit`, `cpq_import_runs`
- Legacy bridge: `sku_rules`

---

## 2) Runtime table classification

| Table(s) | Classification | Runtime mode | Decision |
|---|---|---|---|
| `app_users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `user_permissions` | Active | Auth + RBAC admin | Keep |
| `audit_log` | Active | Write/read audit | Keep |
| `feature_flags`, `feature_flag_audit` | Active admin/config | Flag control plane | Keep |
| `cpq_import_rows` | Active canonical | CPQ source of truth | Keep |
| `cpq_import_row_translations` | Active | Locale overlay | Keep |
| `sku_digit_option_config`, `sku_generation_dependency_rules` | Active admin/config | Setup control plane | Keep |
| `cpq_products`, `cpq_product_attributes` | Active + partially legacy payload | Push + normalized link | Keep table, prune columns |
| `cpq_sku_rules`, `cpq_availability`, `cpq_countries` | Active | Matrix persistence | Keep |
| `cpq_product_assets` | Active (feature-flag path) | Optional picture flow | Keep |
| `cpq_import_runs` | Transitional | Generation diagnostics | Deprecate later |
| `sku_rules` | Cleanup candidate | No runtime API usage | Replace then drop |

---

## 3) Column-level reconciliation highlights

## 3.1 Actively used core columns (examples)

- `cpq_import_rows`: `option_name`, `choice_value`, `digit_position`, `code_value`, `status`, `is_active`, `updated_by`, `updated_at`
- `cpq_import_row_translations`: `cpq_import_row_id`, `locale`, `translated_value`, `updated_by`
- `cpq_sku_rules`: `sku_code`, `cpq_ruleset`, `brake_type`, `bc_status`, `is_active`
- `cpq_availability`: `cpq_sku_rule_id`, `cpq_country_id`, `available`
- `cpq_countries`: `country`, `region`, `brake_type`, `locale_code`

## 3.2 High-confidence cleanup candidates

- `cpq_import_rows.raw_option_name`, `cpq_import_rows.raw_digit`, `cpq_import_rows.raw_code_value`
- Many legacy payload columns in `cpq_products` (batch prune with dependency checks)
- Majority of descriptive counters/payload in `cpq_import_runs` after diagnostics redesign

See full staged list in `docs/column-cleanup-candidates.md`.

---

## 4) Constraint classification

## Required / safety-critical

- CPQ FK chain: availability, product-attributes, translations.
- Domain checks: `brake_type`, `bc_status`, import row `status`, setup rule checks.
- Business unique constraints: active CPQ SKU uniqueness, row+locale translation uniqueness.

## Cleanup candidates

- `sku_rules` constraints + indexes (only as part of table retirement stage).
- Potentially redundant NOT NULL check-export entries after explicit validation.

See `docs/constraint-cleanup-candidates.md`.

---

## 5) Real DB vs repository SQL mismatch (critical)

`sql/schema.sql` is incomplete versus CSV-truth DB.

Tables present in CSV but missing from baseline schema SQL:
- `app_users`, `audit_log`, `cpq_import_rows`, `cpq_import_row_translations`, `cpq_import_runs`, `cpq_products`, `cpq_product_attributes`, `cpq_product_assets`, `feature_flags`, `feature_flag_audit`, `roles`, `user_roles`.

Also, runtime writes `role_permission_baselines_audit` but this object is absent from CSV truth.

Interpretation:
- repo SQL cannot be considered current environment bootstrap truth,
- migration sequencing must explicitly resolve this divergence before further destructive cleanup.

---

## 6) `sku_rules` decision

Verdict: **Replace then remove next (staged)**.

- Runtime no longer depends on `sku_rules`.
- Migrations/seeds still reference it.
- External dependency risk remains non-zero.

Safe sequence:
1. remove remaining seed/migration reliance,
2. verify no external readers/writers,
3. drop constraints/indexes/table in dedicated migration with rollback script.

---

## 7) Immediate next migration step (concrete)

Next DB migration PR should perform exactly:
1. Resolve `role_permission_baselines_audit` mismatch (create table in DB truth or remove runtime writes).
2. Drop `cpq_import_rows.raw_option_name`, `raw_digit`, `raw_code_value`.

Rationale: maximum correctness gain with low operational risk.
