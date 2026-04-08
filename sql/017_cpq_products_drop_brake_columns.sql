-- Wave cleanup: remove cpq_products brake compatibility columns after runtime write-path migration.
-- Evidence:
-- 1) no cpq_products_flat dependency (view never projects these columns),
-- 2) runtime push path now writes brake values via cpq_product_attributes + cpq_sku_rules, not cpq_products columns,
-- 3) no in-repo runtime reads from cpq_products.brake_reverse / brake_non_reverse.

alter table if exists cpq_products
  drop column if exists brake_reverse,
  drop column if exists brake_non_reverse;

-- Rollback (additive, reversible):
-- alter table if exists cpq_products
--   add column if not exists brake_reverse text,
--   add column if not exists brake_non_reverse text;
