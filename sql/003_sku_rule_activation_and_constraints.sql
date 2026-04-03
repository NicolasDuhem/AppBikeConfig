-- Phase 2: SKU rule activation workflow + data integrity constraints

alter table sku_rules
  add column if not exists is_active boolean not null default true,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivation_reason text;

-- Normalize existing code values for case-insensitive uniqueness logic.
update sku_rules
set code_value = upper(trim(code_value))
where code_value is not null;

-- Explicit validation checks to surface legacy bad data clearly.
do $$
declare
  conflicting_active_count integer;
  conflicting_digit_count integer;
begin
  select count(*) into conflicting_active_count
  from (
    select digit_position, upper(trim(code_value)) as normalized_code
    from sku_rules
    where is_active = true
    group by digit_position, upper(trim(code_value))
    having count(*) > 1
  ) dup;

  if conflicting_active_count > 0 then
    raise exception 'Cannot apply migration: duplicate ACTIVE digit+code rows exist in sku_rules. Resolve conflicts first.';
  end if;

  select count(*) into conflicting_digit_count
  from (
    select digit_position
    from sku_rules
    group by digit_position
    having count(distinct lower(trim(option_name))) > 1
  ) bad;

  if conflicting_digit_count > 0 then
    raise notice 'Data quality warning: % digit(s) map to multiple option names in sku_rules. API now blocks new violations.', conflicting_digit_count;
  end if;
end $$;

alter table sku_rules
  add constraint sku_rules_code_value_format_chk
  check (code_value ~ '^[A-Z0-9]$');

create unique index if not exists sku_rules_active_digit_code_uniq
  on sku_rules (digit_position, upper(code_value))
  where is_active = true;

create index if not exists sku_rules_active_lookup_idx
  on sku_rules (is_active, option_name, digit_position);
