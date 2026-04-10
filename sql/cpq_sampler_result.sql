create table if not exists CPQ_sampler_result (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  ipn_code text,
  ruleset text not null,
  account_code text not null,
  customer_id text,
  currency text,
  language text,
  country_code text,
  namespace text,
  header_id text,
  detail_id text,
  session_id text,
  json_result jsonb not null,
  processed_for_image_sync boolean not null default false,
  processed_for_image_sync_at timestamptz
);

create index if not exists idx_cpq_sampler_result_ipn_code
  on CPQ_sampler_result (ipn_code);

create index if not exists idx_cpq_sampler_result_ruleset
  on CPQ_sampler_result (ruleset);

create index if not exists idx_cpq_sampler_result_account_code
  on CPQ_sampler_result (account_code);

create index if not exists idx_cpq_sampler_result_created_at_desc
  on CPQ_sampler_result (created_at desc);

create index if not exists idx_cpq_sampler_result_image_sync_unprocessed
  on CPQ_sampler_result (processed_for_image_sync, id)
  where processed_for_image_sync = false;
