# DATABASE.md

## Purpose

Operational database truth for AppBikeConfig, reconciled against:
- `database schema.csv` (**authoritative schema truth for this run**)
- `database constraints.csv` (**authoritative constraints truth for this run**)
- runtime SQL in `app/**` + `lib/**`
- repository SQL in `sql/**` (explicitly non-authoritative when conflicting)

Date reconciled: **April 8, 2026** (cpq_products_flat fallback-reduction wave: remaining compatibility subset).

---

## 1) Real DB truth summary (CSV)

- 22 tables
- 218 columns
- 214 exported constraint rows
  - CHECK: 135
  - PRIMARY KEY: 34
  - FOREIGN KEY: 29
  - UNIQUE: 16

Table families:
- RBAC/Auth/Audit: `app_users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `role_permission_baselines_audit`, `user_permissions`, `audit_log`
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
| `cpq_import_runs` | Transitional diagnostics | `/api/cpq/generate` GET lifecycle state + metadata read | Keep for now; narrow retained scope and stage retirement |
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

- `cpq_import_rows.raw_option_name`, `cpq_import_rows.raw_digit`, `cpq_import_rows.raw_code_value` (**removed in prior wave via migration 015; rollback SQL included in-file**)
- `cpq_products.product_assist`, `cpq_products.product_family`, `cpq_products.product_line`, `cpq_products.product_model`, `cpq_products.product_type` (**removed in this run via migration 018 after cpq_products_flat fallback reduction; rollback SQL included in-file**)
- `cpq_products.brake_reverse`, `cpq_products.brake_non_reverse` (**removed in prior wave via migration 017; rollback SQL included in-file**)
- `cpq_products.position29`, `cpq_products.position30` (**removed in prior run via migration 016; rollback SQL included in-file**)
- `cpq_products.handlebar_type`, `speeds`, `mudguardsandrack`, `territory`, `mainframecolour`, `rearframecolour`, `frontcarrierblock`, `lighting`, `saddleheight`, `gearratio`, `saddle`, `tyre`, `brakes`, `pedals`, `saddlebag`, `suspension`, `biketype`, `toolkit`, `saddlelight`, `configcode`, `optionbox`, `framematerial`, `frameset`, `componentcolour`, `onbikeaccessories`, `handlebarstemcolour`, `handlebarpincolour`, `frontframecolour`, `frontforkcolour` (**removed in this run via migration 019 after cpq_products_flat fallback reduction; rollback SQL included in-file**).
- Compatibility residue left in `cpq_products`: `description` (kept intentionally for a separate evidence-backed micro-batch).
- `cpq_import_runs` row counters/operational fields remain high-potential cleanup candidates, but should not be dropped until run creation/ownership semantics are fully replaced.

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

`role_permission_baselines_audit` is now part of supported DB truth, aligned across runtime, migrations, and CSV inventories.

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

## 7) Migration decision and deployment/rollback posture

Decision implemented in this run:
1. **Keep** `cpq_import_runs` as a transitional diagnostics object; no destructive drop executed because `/api/cpq/generate` GET still reads generation metadata from this table.
2. Remove the remaining `cpq_products_flat` fallback dependency for compatibility attributes and drop matched `cpq_products` columns in migration `019_cpq_products_flat_remove_remaining_fallback.sql`.
3. Prior wave removals remain in place (`016` position placeholders, `017` brake compatibility columns, `018` product identity columns).

Deployment sequencing:
1. Apply migration `019_cpq_products_flat_remove_remaining_fallback.sql` (view fallback reduction + column drops).
2. Prior migrations `016`-`018` remain part of baseline sequence; no runtime code deployment required in this wave.

Rollback:
- For migration `019`: run additive `alter table ... add column` statements and the rollback `create or replace view cpq_products_flat` block documented directly inside migration `019` to restore dropped columns + fallback behavior.
- For prior migrations `017`/`018`: use in-file additive rollback SQL if restoration is required.
