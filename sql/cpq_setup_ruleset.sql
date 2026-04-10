create table if not exists CPQ_setup_ruleset (
  id bigserial primary key,
  cpq_ruleset text not null unique,
  description text,
  bike_type text,
  namespace text not null default 'Default',
  header_id text not null default 'Simulator',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cpq_setup_ruleset_active_sort
  on CPQ_setup_ruleset (is_active, sort_order, cpq_ruleset);

create index if not exists idx_cpq_setup_ruleset_bike_type
  on CPQ_setup_ruleset (bike_type);
