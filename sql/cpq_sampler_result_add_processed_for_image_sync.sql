-- Add incremental processing markers used by picture-management sync.
alter table if exists CPQ_sampler_result
  add column if not exists processed_for_image_sync boolean not null default false,
  add column if not exists processed_for_image_sync_at timestamptz;

create index if not exists idx_cpq_sampler_result_image_sync_unprocessed
  on CPQ_sampler_result (processed_for_image_sync, id)
  where processed_for_image_sync = false;
