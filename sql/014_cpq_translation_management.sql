alter table if exists cpq_countries
  add column if not exists locale_code text;

update cpq_countries
set locale_code = coalesce(nullif(trim(locale_code), ''), 'en-US')
where locale_code is null
   or trim(locale_code) = '';

alter table if exists cpq_countries
  alter column locale_code set default 'en-US',
  alter column locale_code set not null;

create index if not exists cpq_countries_locale_code_idx
  on cpq_countries (locale_code);

create index if not exists cpq_import_row_translations_locale_idx
  on cpq_import_row_translations (locale);
