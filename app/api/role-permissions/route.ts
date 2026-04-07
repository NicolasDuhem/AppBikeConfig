import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { sql } from '@/lib/db';

export async function GET() {
  const auth = await requireApiRole('permissions.manage');
  if (auth instanceof NextResponse) return auth;

  const rows = await sql`
    select r.role_key, p.permission_key
    from role_permissions rp
    join roles r on r.role_key = rp.role_key
    join permissions p on p.id = rp.permission_id
    order by r.role_key, p.permission_key
  ` as Array<{ role_key: string; permission_key: string }>;

  return NextResponse.json(rows);
}

export async function PATCH(request: Request) {
  const auth = await requireApiRole('permissions.manage');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const roleKey = String(body.role_key || '').trim();
  const permissionKeys = Array.isArray(body.permission_keys) ? body.permission_keys.map((key: any) => String(key)) : [];
  if (!roleKey) return NextResponse.json({ error: 'role_key is required' }, { status: 400 });

  await sql`delete from role_permissions where role_key = ${roleKey}`;
  for (const permissionKey of permissionKeys) {
    await sql`
      insert into role_permissions (role_key, permission_id)
      select ${roleKey}, id from permissions where permission_key = ${permissionKey}
      on conflict do nothing
    `;
    await sql`
      insert into role_permission_baselines_audit (role_key, permission_key, granted, changed_by)
      values (${roleKey}, ${permissionKey}, true, ${auth.user.id})
    `;
  }

  return NextResponse.json({ ok: true });
}
