create table if not exists cpq_countries (
  id bigserial primary key,
  country text not null unique,
  region text not null,
  brake_type text not null check (brake_type in ('reverse', 'non_reverse')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cpq_sku_rules (
  id bigserial primary key,
  cpq_product_id bigint references cpq_products(id) on delete set null,
  sku_code text not null,
  cpq_ruleset text not null,
  brake_type text not null check (brake_type in ('reverse', 'non_reverse')),
  bike_type text,
  handlebar text,
  speed text,
  rack text,
  colour text,
  light text,
  seatpost_length text,
  saddle text,
  description text,
  bc_status text not null default '' check (bc_status in ('', 'ok', 'nok')),
  is_active boolean not null default true,
  deactivated_at timestamptz,
  deactivation_reason text,
  created_by bigint references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cpq_sku_rules_active_unique
  on cpq_sku_rules (lower(sku_code), lower(cpq_ruleset), brake_type)
  where is_active = true;

create index if not exists cpq_sku_rules_ruleset_idx
  on cpq_sku_rules (cpq_ruleset, brake_type, sku_code);

create table if not exists cpq_availability (
  cpq_sku_rule_id bigint not null references cpq_sku_rules(id) on delete cascade,
  cpq_country_id bigint not null references cpq_countries(id) on delete cascade,
  available boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (cpq_sku_rule_id, cpq_country_id)
);

insert into cpq_countries (country, region, brake_type)
select c.country, c.region, 'non_reverse'
from countries c
on conflict (country) do nothing;
