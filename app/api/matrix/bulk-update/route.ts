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
  const productIds = Array.isArray(body.product_ids)
    ? body.product_ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
    : null;

  if (!countryId) return NextResponse.json({ error: 'country_id is required' }, { status: 400 });

  const products = productIds?.length
    ? await sql`select id from products where id = any(${productIds})`
    : bikeType
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
    newData: { countryId, bikeType: bikeType || null, available, updated, filteredScope: productIds?.length ? 'filtered_rows' : 'working_set' }
  });

  return NextResponse.json({ ok: true, updated });
}
