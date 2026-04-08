-- Reconcile CSV-truth environments with runtime RBAC baseline audit writes.
-- Runtime PATCH /api/role-permissions writes this table, so it must exist as supported DB truth.

create table if not exists role_permission_baselines_audit (
  id bigserial primary key,
  role_key text not null references roles(role_key) on delete cascade,
  permission_key text not null,
  granted boolean not null,
  changed_by bigint references app_users(id),
  changed_at timestamptz not null default now()
);
