-- Wave cleanup: remove cpq_products legacy placeholder columns that have no runtime usage.
-- Evidence: no app/lib SQL read/write references and no projection usage in cpq_products_flat.

alter table if exists cpq_products
  drop column if exists position29,
  drop column if exists position30;

-- Rollback path (manual, additive):
-- alter table if exists cpq_products
--   add column if not exists position29 text,
--   add column if not exists position30 text;
