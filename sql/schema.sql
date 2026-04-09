create table if not exists cpq_countries (
  id bigserial primary key,
  country text not null unique,
  region text not null,
  brake_type text not null check (brake_type in ('reverse', 'non_reverse')),
  locale_code text not null default 'en-US',
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

create table if not exists permissions (
  id bigserial primary key,
  permission_key text not null unique,
  permission_name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists role_permissions (
  role_key text not null references roles(role_key) on delete cascade,
  permission_id bigint not null references permissions(id) on delete cascade,
  primary key (role_key, permission_id)
);

create table if not exists role_permission_baselines_audit (
  id bigserial primary key,
  role_key text not null references roles(role_key) on delete cascade,
  permission_key text not null,
  granted boolean not null,
  changed_by bigint references app_users(id),
  changed_at timestamptz not null default now()
);

create table if not exists user_permissions (
  user_id bigint not null references app_users(id) on delete cascade,
  permission_id bigint not null references permissions(id) on delete cascade,
  granted boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, permission_id)
);

create table if not exists sku_digit_option_config (
  id bigserial primary key,
  digit_position integer not null unique check (digit_position between 1 and 30),
  option_name text not null,
  is_required boolean not null default false,
  selection_mode text not null default 'single' check (selection_mode in ('single', 'multi')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sku_generation_dependency_rules (
  id bigserial primary key,
  source_digit_position integer not null check (source_digit_position between 1 and 30),
  target_digit_position integer not null check (target_digit_position between 1 and 30),
  rule_type text not null check (rule_type in ('match_code')),
  active boolean not null default true,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_digit_position, target_digit_position, rule_type)
);
