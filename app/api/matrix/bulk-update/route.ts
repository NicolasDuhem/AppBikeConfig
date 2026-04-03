import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireApiRole } from '@/lib/api-auth';
import { writeAuditLog } from '@/lib/audit';

export async function POST(request: Request) {
  const auth = await requireApiRole('matrix.update.bulk');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const countryId = Number(body.country_id || 0);
  const bikeType = String(body.bike_type || '').trim();
  const available = !!body.available;

  if (!countryId) return NextResponse.json({ error: 'country_id is required' }, { status: 400 });

  const products = bikeType
    ? await sql`select id from products where bike_type = ${bikeType}`
    : await sql`select id from products`;

  let updated = 0;
  for (const row of products as any[]) {
    await sql`
      insert into availability (product_id, country_id, available, updated_at)
      values (${row.id}, ${countryId}, ${available}, now())
      on conflict (product_id, country_id)
      do update set available = excluded.available, updated_at = now()
    `;
    updated += 1;
  }

  await writeAuditLog({
    userId: auth.user.id,
    actionKey: 'matrix.update.bulk',
    entityType: 'availability',
    newData: { countryId, bikeType: bikeType || null, available, updated }
  });

  return NextResponse.json({ ok: true, updated });
}
