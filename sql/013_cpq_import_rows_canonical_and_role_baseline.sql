-- Canonicalize SKU definition onto cpq_import_rows and add role baseline management metadata.

alter table if exists cpq_import_rows
  add column if not exists is_active boolean not null default true,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivation_reason text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by bigint references app_users(id),
  add column if not exists source text;

update cpq_import_rows
set source = coalesce(source, action_attempted, 'cpq_import')
where source is null;

-- Backfill legacy sku_rules into cpq_import_rows if missing.
insert into cpq_import_rows (
  import_run_id,
  row_number,
  option_name,
  choice_value,
  digit_position,
  code_value,
  status,
  normalized_option_name,
  action_attempted,
  is_active,
  deactivated_at,
  deactivation_reason,
  source
)
select
  null,
  0,
  r.option_name,
  r.choice_value,
  r.digit_position,
  r.code_value,
  'imported',
  r.option_name,
  'backfill_sku_rules',
  coalesce(r.is_active, true),
  r.deactivated_at,
  r.deactivation_reason,
  'sku_rules_backfill'
from sku_rules r
where not exists (
  select 1
  from cpq_import_rows ir
  where ir.status = 'imported'
    and lower(coalesce(ir.option_name, '')) = lower(coalesce(r.option_name, ''))
    and lower(coalesce(ir.choice_value, '')) = lower(coalesce(r.choice_value, ''))
    and coalesce(ir.digit_position, -1) = coalesce(r.digit_position, -1)
    and upper(coalesce(ir.code_value, '')) = upper(coalesce(r.code_value, ''))
);

-- Keep one active canonical row per structural key.
with ranked as (
  select id,
         row_number() over (
           partition by coalesce(digit_position, -1), lower(coalesce(option_name, '')), upper(coalesce(code_value, ''))
           order by is_active desc, id desc
         ) as rn
  from cpq_import_rows
  where status = 'imported'
)
update cpq_import_rows ir
set is_active = false,
    deactivated_at = coalesce(ir.deactivated_at, now()),
    deactivation_reason = coalesce(ir.deactivation_reason, 'Auto-deactivated duplicate canonical row during cpq_import_rows canonicalization'),
    updated_at = now()
from ranked r
where ir.id = r.id
  and r.rn > 1
  and ir.is_active = true;

create unique index if not exists cpq_import_rows_active_structural_uniq
  on cpq_import_rows (coalesce(digit_position, -1), lower(coalesce(option_name, '')), upper(coalesce(code_value, '')))
  where status = 'imported' and is_active = true;

create index if not exists cpq_import_rows_active_digit_idx
  on cpq_import_rows (digit_position, lower(option_name), is_active)
  where status = 'imported';

create table if not exists role_permission_baselines_audit (
  id bigserial primary key,
  role_key text not null references roles(role_key) on delete cascade,
  permission_key text not null,
  granted boolean not null,
  changed_by bigint references app_users(id),
  changed_at timestamptz not null default now()
);
