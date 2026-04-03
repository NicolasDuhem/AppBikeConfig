-- Phase 1: Authentication + RBAC + audit tables

create table if not exists app_users (
  id bigserial primary key,
  email text not null unique,
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists roles (
  id bigserial primary key,
  role_key text not null unique,
  role_name text not null
);

create table if not exists user_roles (
  user_id bigint not null references app_users(id) on delete cascade,
  role_id bigint not null references roles(id) on delete cascade,
  primary key (user_id, role_id)
);

create table if not exists audit_log (
  id bigserial primary key,
  user_id bigint references app_users(id),
  action_key text not null,
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

insert into roles (role_key, role_name)
values
  ('sys_admin', 'System Administrator'),
  ('sales_admin', 'Sales Administrator'),
  ('sales_standard', 'Sales Standard'),
  ('product_admin', 'Product Administrator'),
  ('read_only', 'Read Only')
on conflict (role_key) do update set role_name = excluded.role_name;

-- Optional bootstrap user: replace values before running in production.
-- insert into app_users (email, password_hash)
-- values ('admin@example.com', '$2b$12$replace_me_with_bcrypt_hash')
-- on conflict (email) do nothing;
--
-- insert into user_roles (user_id, role_id)
-- select u.id, r.id from app_users u join roles r on r.role_key = 'sys_admin'
-- where u.email = 'admin@example.com'
-- on conflict do nothing;
