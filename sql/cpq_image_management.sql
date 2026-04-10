create table if not exists cpq_image_management (
  id bigserial primary key,
  feature_label text not null,
  option_label text not null,
  option_value text not null,
  picture_link_1 text,
  picture_link_2 text,
  picture_link_3 text,
  picture_link_4 text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cpq_image_management_unique_option_combo unique (feature_label, option_label, option_value)
);

create index if not exists idx_cpq_image_management_active
  on cpq_image_management (is_active, feature_label, option_label);

create index if not exists idx_cpq_image_management_option_value
  on cpq_image_management (option_value);

create index if not exists idx_cpq_image_management_missing_picture
  on cpq_image_management (feature_label)
  where
    (picture_link_1 is null or btrim(picture_link_1) = '')
    and (picture_link_2 is null or btrim(picture_link_2) = '')
    and (picture_link_3 is null or btrim(picture_link_3) = '')
    and (picture_link_4 is null or btrim(picture_link_4) = '');

create or replace function CPQ_setup_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_cpq_image_management_updated_at on cpq_image_management;
create trigger trg_cpq_image_management_updated_at
before update on cpq_image_management
for each row
execute function CPQ_setup_set_updated_at();
