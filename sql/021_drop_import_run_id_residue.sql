-- Remove staged cpq_import_runs residue columns after table retirement in 020.
-- Forward:
-- 1) drop cpq_import_rows.import_run_id
-- 2) drop cpq_products.import_run_id

drop index if exists cpq_import_rows_run_idx;

alter table if exists cpq_import_rows
  drop column if exists import_run_id;

alter table if exists cpq_products
  drop column if exists import_run_id;

-- Rollback posture (additive + non-destructive):
-- alter table if exists cpq_import_rows
--   add column if not exists import_run_id bigint;
--
-- create index if not exists cpq_import_rows_run_idx
--   on cpq_import_rows(import_run_id, status);
--
-- alter table if exists cpq_products
--   add column if not exists import_run_id bigint;
