import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { requireApiRole } from '@/lib/api-auth';
import { writeAuditLog } from '@/lib/audit';

export async function GET() {
  const auth = await requireApiRole('users.manage');
  if (auth instanceof NextResponse) return auth;

  const rows = await sql`
    select u.id, u.email, u.is_active, u.created_at,
      coalesce(array_agg(distinct r.role_key) filter (where r.role_key is not null), '{}') as roles,
      coalesce(jsonb_agg(distinct jsonb_build_object('permission_key', p.permission_key, 'granted', up.granted)) filter (where p.permission_key is not null), '[]'::jsonb) as user_permission_overrides
    from app_users u
    left join user_roles ur on ur.user_id = u.id
    left join roles r on r.id = ur.role_id
    left join user_permissions up on up.user_id = u.id
    left join permissions p on p.id = up.permission_id
    group by u.id
    order by u.email
  `;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const auth = await requireApiRole('users.manage');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const roleKeys = Array.isArray(body.role_keys) ? body.role_keys.map((r: any) => String(r)) : [];

  if (!email || !password || !roleKeys.length) {
    return NextResponse.json({ error: 'email, password and role_keys are required' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const inserted = await sql`
    insert into app_users (email, password_hash, is_active)
    values (${email}, ${passwordHash}, true)
    returning id, email, is_active
  ` as any[];

  const user = inserted[0];
  for (const key of roleKeys) {
    await sql`
      insert into user_roles (user_id, role_id)
      select ${user.id}, id from roles where role_key = ${key}
      on conflict do nothing
    `;
  }

  await writeAuditLog({
    userId: auth.user.id,
    actionKey: 'users.create',
    entityType: 'app_user',
    entityId: String(user.id),
    newData: { email, roleKeys }
  });

  return NextResponse.json({ ok: true, user });
}

export async function PATCH(request: Request) {
  const auth = await requireApiRole('users.manage');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const userId = Number(body.user_id || 0);
  const roleKeys = Array.isArray(body.role_keys) ? body.role_keys.map((r: any) => String(r)) : null;
  const isActive = typeof body.is_active === 'boolean' ? body.is_active : null;
  const permissionOverrides = Array.isArray(body.permission_overrides)
    ? body.permission_overrides.map((item: any) => ({ permission_key: String(item.permission_key || ''), granted: Boolean(item.granted) }))
    : null;

  if (!userId) return NextResponse.json({ error: 'user_id is required' }, { status: 400 });

  if (roleKeys) {
    await sql`delete from user_roles where user_id = ${userId}`;
    for (const key of roleKeys) {
      await sql`
        insert into user_roles (user_id, role_id)
        select ${userId}, id from roles where role_key = ${key}
        on conflict do nothing
      `;
    }
    await writeAuditLog({
      userId: auth.user.id,
      actionKey: 'users.role_assignment',
      entityType: 'app_user',
      entityId: String(userId),
      newData: { roleKeys }
    });
  }

  if (isActive !== null) {
    await sql`update app_users set is_active = ${isActive}, updated_at = now() where id = ${userId}`;
    await writeAuditLog({
      userId: auth.user.id,
      actionKey: 'users.activation',
      entityType: 'app_user',
      entityId: String(userId),
      newData: { isActive }
    });
  }

  if (permissionOverrides) {
    const authz = await requireApiRole('permissions.manage');
    if (authz instanceof NextResponse) return authz;

    await sql`delete from user_permissions where user_id = ${userId}`;
    for (const override of permissionOverrides) {
      if (!override.permission_key) continue;
      await sql`
        insert into user_permissions (user_id, permission_id, granted)
        select ${userId}, p.id, ${override.granted}
        from permissions p
        where p.permission_key = ${override.permission_key}
        on conflict (user_id, permission_id) do update
        set granted = excluded.granted,
            updated_at = now()
      `;
    }

    await writeAuditLog({
      userId: auth.user.id,
      actionKey: 'permissions.manage',
      entityType: 'app_user',
      entityId: String(userId),
      newData: { permissionOverrides }
    });
  }

  return NextResponse.json({ ok: true });
}
