create table if not exists CPQ_setup_account_context (
  id bigserial primary key,
  account_code text not null unique,
  customer_id text not null,
  currency text not null,
  language text not null,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cpq_setup_account_context_active
  on CPQ_setup_account_context (is_active, account_code);

create index if not exists idx_cpq_setup_account_context_customer
  on CPQ_setup_account_context (customer_id);

create index if not exists idx_cpq_setup_account_context_country_code
  on CPQ_setup_account_context (country_code);
