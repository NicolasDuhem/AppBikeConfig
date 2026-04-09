-- Final cpq_import_runs retirement.
-- Forward:
-- 1) remove FK coupling from cpq_import_rows/cpq_products,
-- 2) drop cpq_import_runs,
-- 3) retain import_run_id columns as staged nullable residue for compatibility.

alter table if exists cpq_import_rows
  drop constraint if exists cpq_import_rows_import_run_id_fkey;

alter table if exists cpq_products
  drop constraint if exists cpq_products_import_run_id_fkey;

drop table if exists cpq_import_runs;

-- Rollback posture (additive + non-destructive):
-- create table if not exists cpq_import_runs (
--   id bigserial primary key,
--   file_name text not null,
--   selected_line text not null,
--   electric_type text not null,
--   is_special boolean not null,
--   special_edition_name text,
--   character_17 text not null check (character_17 ~ '^[A-Z0-9]$'),
--   uploaded_by bigint not null references app_users(id),
--   uploaded_at timestamptz not null default now(),
--   rows_read integer not null default 0,
--   rows_imported integer not null default 0,
--   rows_skipped integer not null default 0,
--   rows_deactivated integer not null default 0,
--   rows_inserted integer not null default 0,
--   status text not null default 'created' check (status in ('created', 'completed', 'failed')),
--   current_phase text,
--   error_message text,
--   error_stack text,
--   failed_at timestamptz,
--   started_at timestamptz not null default now(),
--   completed_at timestamptz,
--   is_dry_run boolean not null default false
-- );
--
-- alter table if exists cpq_import_rows
--   add constraint cpq_import_rows_import_run_id_fkey
--   foreign key (import_run_id) references cpq_import_runs(id) on delete cascade;
--
-- alter table if exists cpq_products
--   add constraint cpq_products_import_run_id_fkey
--   foreign key (import_run_id) references cpq_import_runs(id);
