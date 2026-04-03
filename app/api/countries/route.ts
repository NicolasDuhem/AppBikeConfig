import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireApiLogin, requireApiRole } from '@/lib/api-auth';
import { writeAuditLog } from '@/lib/audit';

export async function GET() {
  const auth = await requireApiLogin();
  if (auth instanceof NextResponse) return auth;

  const rows = await sql`select id, country, region from countries order by region, country`;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const auth = await requireApiRole('country.add');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const country = String(body.country || '').trim();
  const region = String(body.region || '').trim();
  if (!country || !region) return NextResponse.json({ error: 'country and region are required' }, { status: 400 });

  const rows = await sql`
    insert into countries (country, region)
    values (${country}, ${region})
    on conflict (country) do update set region = excluded.region
    returning id, country, region
  ` as any[];

  await writeAuditLog({
    userId: auth.user.id,
    actionKey: 'country.add',
    entityType: 'country',
    entityId: String(rows[0].id),
    newData: rows[0]
  });

  return NextResponse.json(rows[0]);
}
