-- Drop import-era diagnostic residue columns from the canonical cpq_import_rows table.
-- Dependency verification for runtime APIs confirms no active read/write path on these columns.

alter table if exists cpq_import_rows
  drop column if exists raw_option_name,
  drop column if exists raw_digit,
  drop column if exists raw_code_value;

-- Rollback path (manual, additive):
-- alter table if exists cpq_import_rows
--   add column if not exists raw_option_name text,
--   add column if not exists raw_digit text,
--   add column if not exists raw_code_value text;
