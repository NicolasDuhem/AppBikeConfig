import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { getFeatureFlags } from '@/lib/feature-flags';
import { sql } from '@/lib/db';

export async function GET() {
  const auth = await requireApiRole('feature_flags.manage');
  if (auth instanceof NextResponse) return auth;

  const rows = await getFeatureFlags();
  return NextResponse.json({ rows });
}

export async function PATCH(request: Request) {
  const auth = await requireApiRole('feature_flags.manage');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const flagKey = String(body.flag_key || '').trim();
  const enabled = !!body.enabled;

  if (!flagKey) return NextResponse.json({ error: 'flag_key is required' }, { status: 400 });

  const existing = await sql`select id, enabled from feature_flags where flag_key = ${flagKey} limit 1` as any[];
  if (!existing.length) return NextResponse.json({ error: 'Flag not found' }, { status: 404 });

  const updated = await sql`
    update feature_flags
    set enabled = ${enabled}, updated_at = now(), updated_by = ${auth.user.id}
    where flag_key = ${flagKey}
    returning id, flag_key
  ` as any[];

  await sql`
    insert into feature_flag_audit (feature_flag_id, flag_key, old_enabled, new_enabled, updated_by)
    values (${existing[0].id}, ${flagKey}, ${existing[0].enabled}, ${enabled}, ${auth.user.id})
  `;

  return NextResponse.json({ ok: true, row: updated[0] });
}
