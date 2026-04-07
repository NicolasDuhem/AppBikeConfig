-- Allow digit 0 rows to carry static/default attributes with '-' code values.
alter table sku_rules
  drop constraint if exists sku_rules_code_value_check;

alter table sku_rules
  add constraint sku_rules_code_value_check
  check (
    (digit_position = 0 and code_value = '-')
    or (digit_position > 0 and code_value ~ '^[A-Z0-9]$')
  );
