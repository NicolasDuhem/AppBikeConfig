-- Explicit permissions model + configurable SKU generation settings/rules.

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

create table if not exists user_permissions (
  user_id bigint not null references app_users(id) on delete cascade,
  permission_id bigint not null references permissions(id) on delete cascade,
  granted boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, permission_id)
);

create index if not exists user_permissions_user_idx on user_permissions (user_id, granted);
create index if not exists role_permissions_role_idx on role_permissions (role_key);

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

create index if not exists sku_digit_option_config_active_idx
  on sku_digit_option_config (is_active, digit_position);

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

create index if not exists sku_generation_dependency_rules_active_idx
  on sku_generation_dependency_rules (active, source_digit_position, target_digit_position, sort_order);

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
    ('sys_admin', 'matrix.view'),
    ('sys_admin', 'matrix.update.single'),
    ('sys_admin', 'matrix.update.bulk'),
    ('sys_admin', 'country.add'),
    ('sys_admin', 'setup.manage'),
    ('sys_admin', 'sku.manage'),
    ('sys_admin', 'sku.delete'),
    ('sys_admin', 'builder.use'),
    ('sys_admin', 'builder.push'),
    ('sys_admin', 'users.manage'),
    ('sys_admin', 'permissions.manage'),
    ('sys_admin', 'feature_flags.manage'),
    ('sales_admin', 'matrix.view'),
    ('sales_admin', 'matrix.update.single'),
    ('sales_admin', 'matrix.update.bulk'),
    ('sales_admin', 'country.add'),
    ('sales_standard', 'matrix.view'),
    ('sales_standard', 'matrix.update.single'),
    ('product_admin', 'matrix.view'),
    ('product_admin', 'setup.manage'),
    ('product_admin', 'sku.manage'),
    ('product_admin', 'sku.delete'),
    ('product_admin', 'builder.use'),
    ('product_admin', 'builder.push'),
    ('read_only', 'matrix.view')
) mappings(role_key, permission_key)
join permissions p on p.permission_key = mappings.permission_key
on conflict do nothing;

insert into sku_digit_option_config (digit_position, option_name, is_required, selection_mode, is_active)
select distinct
  r.digit_position,
  r.option_name,
  false,
  'multi',
  true
from sku_rules r
where r.digit_position between 1 and 30
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
