create table if not exists feature_flags (
  id bigserial primary key,
  flag_key text not null unique,
  flag_name text not null,
  description text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by bigint references app_users(id)
);

create table if not exists feature_flag_audit (
  id bigserial primary key,
  feature_flag_id bigint not null references feature_flags(id) on delete cascade,
  flag_key text not null,
  old_enabled boolean,
  new_enabled boolean not null,
  updated_at timestamptz not null default now(),
  updated_by bigint references app_users(id)
);

create table if not exists cpq_import_runs (
  id bigserial primary key,
  file_name text not null,
  selected_line text not null,
  electric_type text not null,
  is_special boolean not null,
  special_edition_name text,
  character_17 text not null check (character_17 ~ '^[A-Z0-9]$'),
  uploaded_by bigint not null references app_users(id),
  uploaded_at timestamptz not null default now(),
  rows_read integer not null default 0,
  rows_imported integer not null default 0,
  rows_skipped integer not null default 0,
  rows_deactivated integer not null default 0,
  rows_inserted integer not null default 0
);

create table if not exists cpq_import_rows (
  id bigserial primary key,
  import_run_id bigint not null references cpq_import_runs(id) on delete cascade,
  row_number integer not null,
  option_name text,
  choice_value text,
  digit_position integer,
  code_value text,
  status text not null check (status in ('imported', 'skipped', 'error')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists cpq_import_rows_run_idx on cpq_import_rows(import_run_id, status);

create table if not exists cpq_products (
  id bigserial primary key,
  import_run_id bigint references cpq_import_runs(id),
  cpq_ruleset text,
  product_assist text,
  product_family text,
  product_line text,
  product_model text,
  product_type text,
  brake_reverse text,
  brake_non_reverse text,
  sku_code text not null,
  description text,
  handlebar_type text,
  speeds text,
  mudguardsandrack text,
  territory text,
  mainframecolour text,
  rearframecolour text,
  frontcarrierblock text,
  lighting text,
  saddleheight text,
  gearratio text,
  saddle text,
  tyre text,
  brakes text,
  pedals text,
  saddlebag text,
  suspension text,
  biketype text,
  toolkit text,
  saddlelight text,
  configcode text,
  optionbox text,
  framematerial text,
  frameset text,
  componentcolour text,
  onbikeaccessories text,
  handlebarstemcolour text,
  handlebarpincolour text,
  frontframecolour text,
  frontforkcolour text,
  position29 text,
  position30 text,
  created_by bigint references app_users(id),
  created_at timestamptz not null default now()
);

insert into feature_flags (flag_key, flag_name, description, enabled)
values (
  'import_csv_cpq',
  'Import CSV CPQ',
  'Enables CPQ CSV import flow and CPQ product generation workflow.',
  false
)
on conflict (flag_key) do update
set flag_name = excluded.flag_name,
    description = excluded.description;
