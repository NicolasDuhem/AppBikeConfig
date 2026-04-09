-- Final legacy cleanup: drop retired sku_rules table and table-specific constraints/indexes.
-- Preconditions verified in-repo:
-- - active runtime paths do not query sku_rules,
-- - setup/bootstrap seed derives sku_digit_option_config from cpq_import_rows,
-- - remaining references are historical migration residue only.

-- Forward
alter table if exists sku_rules
  drop constraint if exists sku_rules_code_value_check,
  drop constraint if exists sku_rules_code_value_format_chk;

drop index if exists sku_rules_active_digit_code_uniq;
drop index if exists sku_rules_active_digit_code_nonzero_uniq;
drop index if exists sku_rules_active_static_option_code_uniq;
drop index if exists sku_rules_active_lookup_idx;

drop table if exists sku_rules;

-- Rollback (explicit)
-- create table if not exists sku_rules (
--   id bigserial primary key,
--   digit_position integer not null,
--   option_name text not null,
--   code_value text not null check (((digit_position = 0 and code_value = '-')) or ((digit_position > 0 and code_value ~ '^[A-Z0-9]$'))),
--   choice_value text not null,
--   description_element text,
--   is_active boolean not null default true,
--   deactivated_at timestamptz,
--   deactivation_reason text
-- );
--
-- create unique index if not exists sku_rules_active_digit_code_nonzero_uniq
--   on sku_rules (digit_position, upper(code_value))
--   where is_active = true and digit_position > 0;
--
-- create unique index if not exists sku_rules_active_static_option_code_uniq
--   on sku_rules (lower(option_name), upper(code_value))
--   where is_active = true and digit_position = 0;
--
-- create index if not exists sku_rules_active_lookup_idx
--   on sku_rules (is_active, option_name, digit_position);
--
-- alter table if exists sku_rules
--   add constraint sku_rules_code_value_check
--   check (((digit_position = 0 and code_value = '-') or (digit_position > 0 and code_value ~ '^[A-Z0-9]$')));
