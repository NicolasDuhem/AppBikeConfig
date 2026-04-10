-- Remove feature_id/option_id from cpq_image_management and keep uniqueness on label/value identity.
alter table if exists cpq_image_management
  drop column if exists feature_id,
  drop column if exists option_id;

alter table if exists cpq_image_management
  drop constraint if exists cpq_image_management_unique_option_combo;

alter table if exists cpq_image_management
  add constraint cpq_image_management_unique_option_combo
  unique (feature_label, option_label, option_value);
