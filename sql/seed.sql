insert into cpq_import_rows (row_number, option_name, choice_value, digit_position, code_value, status, normalized_option_name, action_attempted, source)
values
(1,'Handlebar','Medium',1,'2','imported','Handlebar','seed','seed'),
(2,'Speed','4 speed',2,'4','imported','Speed','seed','seed'),
(3,'Rack','R-Version',3,'R','imported','Rack','seed','seed')
on conflict do nothing;

insert into feature_flags (flag_key, flag_name, description, enabled)
values ('import_csv_cpq','Import CSV CPQ','Enables CPQ CSV import flow and CPQ product generation workflow.',false)
on conflict (flag_key) do update set flag_name = excluded.flag_name, description = excluded.description;

insert into feature_flags (flag_key, flag_name, description, enabled)
values ('cpq_bdam_picture_picker','CPQ BDAM Picture Picker','Enables the BDAM iframe-based picture picker on CPQ Matrix items.',false)
on conflict (flag_key) do update set flag_name = excluded.flag_name, description = excluded.description;

insert into cpq_countries (country, region, brake_type, locale_code)
values
  ('France','EMEA','non_reverse','fr-FR'),
  ('United Kingdom','EMEA','non_reverse','en-GB'),
  ('Germany','EMEA','non_reverse','de-DE')
on conflict (country) do update
set region = excluded.region,
    brake_type = excluded.brake_type,
    locale_code = excluded.locale_code,
    updated_at = now();

insert into permissions (permission_key, permission_name, description)
values
  ('matrix.view', 'View Sales - SKU vs Country', 'Access matrix and read SKU-country status.'),
  ('matrix.update.single', 'Update single matrix row', 'Edit one SKU-country cell at a time.'),
  ('matrix.update.bulk', 'Bulk update matrix', 'Run bulk matrix updates.'),
  ('country.add', 'Add countries', 'Add new country mappings.'),
  ('setup.manage', 'Manage Product - Setup', 'Configure digit option behavior and dependency rules.'),
  ('sku.manage', 'Manage SKU definitions', 'Create/edit/deactivate SKU definition rows.'),
  ('sku.delete', 'Delete SKU definitions', 'Permanently delete SKU definition rows when safe.'),
  ('builder.use', 'Generate SKUs', 'Use Product - Create SKU generation.'),
  ('builder.push', 'Push generated SKUs', 'Push generated SKUs to Sales - SKU vs Country.'),
  ('users.manage', 'Manage users', 'Create users, set roles, activate/deactivate.'),
  ('permissions.manage', 'Manage user permissions', 'Manage per-user permission overrides.'),
  ('feature_flags.manage', 'Manage feature flags', 'Update feature toggles.')
on conflict (permission_key) do update
set permission_name = excluded.permission_name,
    description = excluded.description;

insert into role_permissions (role_key, permission_id)
select mappings.role_key, p.id
from (
  values
    ('sys_admin', 'matrix.view'), ('sys_admin', 'matrix.update.single'), ('sys_admin', 'matrix.update.bulk'),
    ('sys_admin', 'country.add'), ('sys_admin', 'setup.manage'), ('sys_admin', 'sku.manage'), ('sys_admin', 'sku.delete'),
    ('sys_admin', 'builder.use'), ('sys_admin', 'builder.push'), ('sys_admin', 'users.manage'), ('sys_admin', 'permissions.manage'), ('sys_admin', 'feature_flags.manage'),
    ('sales_admin', 'matrix.view'), ('sales_admin', 'matrix.update.single'), ('sales_admin', 'matrix.update.bulk'), ('sales_admin', 'country.add'),
    ('sales_standard', 'matrix.view'), ('sales_standard', 'matrix.update.single'),
    ('product_admin', 'matrix.view'), ('product_admin', 'setup.manage'), ('product_admin', 'sku.manage'), ('product_admin', 'sku.delete'), ('product_admin', 'builder.use'), ('product_admin', 'builder.push'),
    ('read_only', 'matrix.view')
) mappings(role_key, permission_key)
join permissions p on p.permission_key = mappings.permission_key
on conflict do nothing;

insert into sku_digit_option_config (digit_position, option_name, is_required, selection_mode, is_active)
select distinct r.digit_position, r.option_name, false, 'multi', true
from cpq_import_rows r
where r.status = 'imported'
  and coalesce(r.is_active, true) = true
  and r.digit_position between 1 and 30
on conflict (digit_position) do update
set option_name = excluded.option_name,
    updated_at = now();

insert into sku_generation_dependency_rules (source_digit_position, target_digit_position, rule_type, active, sort_order, notes)
values
  (5, 27, 'match_code', true, 10, 'MainFrameColour forces FrontFrameColour code alignment'),
  (6, 25, 'match_code', true, 20, 'RearFrameColour forces HandlebarStemColour code alignment'),
  (6, 26, 'match_code', true, 30, 'RearFrameColour forces HandlebarPinColour code alignment'),
  (6, 28, 'match_code', true, 40, 'RearFrameColour forces FrontForkColour code alignment')
on conflict (source_digit_position, target_digit_position, rule_type) do update
set active = excluded.active,
    sort_order = excluded.sort_order,
    notes = excluded.notes,
    updated_at = now();
