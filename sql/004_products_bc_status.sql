alter table products
  add column if not exists bc_status text not null default '';

alter table products
  drop constraint if exists products_bc_status_check;

alter table products
  add constraint products_bc_status_check
  check (bc_status in ('', 'ok', 'nok'));
