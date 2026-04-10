-- Expand cpq_image_management from one picture_link column to four picture slots.
alter table if exists cpq_image_management
  add column if not exists picture_link_1 text,
  add column if not exists picture_link_2 text,
  add column if not exists picture_link_3 text,
  add column if not exists picture_link_4 text;

-- Preserve existing picture_link values by moving them into picture_link_1
-- only when picture_link_1 is currently empty.
update cpq_image_management
set picture_link_1 = picture_link
where picture_link is not null
  and btrim(picture_link) <> ''
  and (picture_link_1 is null or btrim(picture_link_1) = '');

-- Replace missing-picture index logic to account for all four slots.
drop index if exists idx_cpq_image_management_missing_picture;
create index if not exists idx_cpq_image_management_missing_picture
  on cpq_image_management (feature_label)
  where
    (picture_link_1 is null or btrim(picture_link_1) = '')
    and (picture_link_2 is null or btrim(picture_link_2) = '')
    and (picture_link_3 is null or btrim(picture_link_3) = '')
    and (picture_link_4 is null or btrim(picture_link_4) = '');

-- Remove legacy single-link column after successful backfill.
alter table if exists cpq_image_management
  drop column if exists picture_link;
