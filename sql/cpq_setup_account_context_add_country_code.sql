-- Adds country_code to CPQ_setup_account_context and enforces ISO-3166 alpha-2 format.
-- Backfill strategy:
--   Uses 'GB' for existing null/blank rows. Adjust the UPDATE statement if your tenant default differs.

begin;

alter table CPQ_setup_account_context
  add column if not exists country_code text;

update CPQ_setup_account_context
set country_code = upper(coalesce(nullif(trim(country_code), ''), 'GB'))
where country_code is null
   or trim(country_code) = '';

alter table CPQ_setup_account_context
  alter column country_code set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cpq_setup_account_context_country_code_iso2_chk'
      and conrelid = 'cpq_setup_account_context'::regclass
  ) then
    alter table CPQ_setup_account_context
      add constraint cpq_setup_account_context_country_code_iso2_chk
      check (country_code ~ '^[A-Z]{2}$');
  end if;
end $$;

create index if not exists idx_cpq_setup_account_context_country_code
  on CPQ_setup_account_context (country_code);

commit;
