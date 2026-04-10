create or replace function CPQ_setup_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_cpq_setup_account_context_updated_at on CPQ_setup_account_context;
create trigger trg_cpq_setup_account_context_updated_at
before update on CPQ_setup_account_context
for each row
execute function CPQ_setup_set_updated_at();

drop trigger if exists trg_cpq_setup_ruleset_updated_at on CPQ_setup_ruleset;
create trigger trg_cpq_setup_ruleset_updated_at
before update on CPQ_setup_ruleset
for each row
execute function CPQ_setup_set_updated_at();

insert into CPQ_setup_account_context (account_code, customer_id, currency, language, country_code, is_active)
values
  ('A000', 'CUST-0001', 'GBP', 'en-GB', 'GB', true),
  ('A100', 'CUST-0100', 'EUR', 'en-GB', 'FR', true),
  ('A200', 'CUST-0200', 'USD', 'en-US', 'US', true)
on conflict (account_code) do update
set customer_id = excluded.customer_id,
    currency = excluded.currency,
    language = excluded.language,
    country_code = excluded.country_code,
    is_active = excluded.is_active;

insert into CPQ_setup_ruleset (cpq_ruleset, description, bike_type, namespace, header_id, sort_order, is_active)
values
  ('BBLV6_G-LineMY26', 'G-Line default', 'G-Line', 'Default', 'Simulator', 10, true),
  ('BBLV6_C-LineMY26', 'C-Line default', 'C-Line', 'Default', 'Simulator', 20, true),
  ('BBLV6_P-LineMY26', 'P-Line default', 'P-Line', 'Default', 'Simulator', 30, true)
on conflict (cpq_ruleset) do update
set description = excluded.description,
    bike_type = excluded.bike_type,
    namespace = excluded.namespace,
    header_id = excluded.header_id,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;
