alter table if exists cpq_import_runs
  add column if not exists status text not null default 'created' check (status in ('created', 'completed', 'failed')),
  add column if not exists current_phase text,
  add column if not exists error_message text,
  add column if not exists error_stack text,
  add column if not exists failed_at timestamptz,
  add column if not exists started_at timestamptz not null default now(),
  add column if not exists completed_at timestamptz,
  add column if not exists is_dry_run boolean not null default false;

alter table if exists cpq_import_rows
  add column if not exists raw_option_name text,
  add column if not exists raw_digit text,
  add column if not exists raw_code_value text,
  add column if not exists normalized_option_name text,
  add column if not exists action_attempted text;

drop index if exists sku_rules_active_digit_code_uniq;

create unique index if not exists sku_rules_active_digit_code_nonzero_uniq
  on sku_rules (digit_position, upper(code_value))
  where is_active = true and digit_position > 0;

create unique index if not exists sku_rules_active_static_option_code_uniq
  on sku_rules (lower(option_name), upper(code_value))
  where is_active = true and digit_position = 0;
