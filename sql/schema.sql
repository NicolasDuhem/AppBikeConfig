create table if not exists products (
  id bigserial primary key,
  sku_code text not null unique,
  handlebar text,
  speed text,
  rack text,
  bike_type text,
  colour text,
  light text,
  seatpost_length text,
  saddle text,
  description text,
  bc_status text not null default '' check (bc_status in ('', 'ok', 'nok')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists countries (
  id bigserial primary key,
  country text not null unique,
  region text not null,
  created_at timestamptz not null default now()
);

create table if not exists availability (
  product_id bigint not null references products(id) on delete cascade,
  country_id bigint not null references countries(id) on delete cascade,
  available boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (product_id, country_id)
);

create table if not exists sku_rules (
  id bigserial primary key,
  digit_position integer not null,
  option_name text not null,
  code_value text not null check (code_value ~ '^[A-Z0-9]$'),
  choice_value text not null,
  description_element text,
  is_active boolean not null default true,
  deactivated_at timestamptz,
  deactivation_reason text
);

create unique index if not exists sku_rules_active_digit_code_uniq
  on sku_rules (digit_position, upper(code_value))
  where is_active = true;

create index if not exists sku_rules_active_lookup_idx
  on sku_rules (is_active, option_name, digit_position);

create table if not exists setup_options (
  id bigserial primary key,
  option_name text not null,
  choice_value text not null,
  sort_order integer not null default 0
);

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

create table if not exists cpq_availability (
  cpq_sku_rule_id bigint not null references cpq_sku_rules(id) on delete cascade,
  cpq_country_id bigint not null references cpq_countries(id) on delete cascade,
  available boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (cpq_sku_rule_id, cpq_country_id)
);
