create table if not exists cpq_product_assets (
  id bigserial primary key,
  cpq_sku_rule_id bigint not null unique references cpq_sku_rules(id) on delete cascade,
  asset_url text not null,
  png_url text,
  asset_id text,
  notes text,
  selected_by bigint not null references app_users(id),
  selected_at timestamptz not null default now(),
  updated_by bigint references app_users(id),
  updated_at timestamptz not null default now()
);

create index if not exists cpq_product_assets_asset_id_idx
  on cpq_product_assets (asset_id);

insert into feature_flags (flag_key, flag_name, description, enabled)
values (
  'cpq_bdam_picture_picker',
  'CPQ BDAM Picture Picker',
  'Enables the BDAM iframe-based picture picker on CPQ Matrix items.',
  false
)
on conflict (flag_key) do update
set flag_name = excluded.flag_name,
    description = excluded.description;
