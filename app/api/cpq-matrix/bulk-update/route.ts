import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireApiRole } from '@/lib/api-auth';
import { writeAuditLog } from '@/lib/audit';

export async function POST(request: Request) {
  const auth = await requireApiRole('matrix.update.bulk');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const countryId = Number(body.country_id || 0);
  const available = !!body.available;
  const productIds = Array.isArray(body.product_ids) ? body.product_ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0) : [];

  if (!countryId) return NextResponse.json({ error: 'country_id is required' }, { status: 400 });

  const countryRows = await sql`select id, country, brake_type from cpq_countries where id = ${countryId} limit 1` as any[];
  if (!countryRows.length) return NextResponse.json({ error: 'Country not found' }, { status: 404 });
  const country = countryRows[0];

  const products = productIds.length ? await sql`select id, brake_type from cpq_sku_rules where id = any(${productIds}) and is_active = true` : await sql`select id, brake_type from cpq_sku_rules where is_active = true`;

  let updated = 0;
  let blocked = 0;
  for (const row of products as any[]) {
    const matches = String(row.brake_type) === String(country.brake_type);
    if (!matches && available) {
      blocked += 1;
      continue;
    }

    await sql`
      insert into cpq_availability (cpq_sku_rule_id, cpq_country_id, available, updated_at)
      values (${row.id}, ${countryId}, ${available}, now())
      on conflict (cpq_sku_rule_id, cpq_country_id)
      do update set available = excluded.available, updated_at = now()
    `;
    updated += 1;
  }

  await writeAuditLog({
    userId: auth.user.id,
    actionKey: 'matrix.update.bulk',
    entityType: 'cpq_availability',
    newData: { countryId, available, updated, blockedByBrakeMismatch: blocked, filteredScope: productIds.length ? 'filtered_rows' : 'working_set' }
  });

  return NextResponse.json({ ok: true, updated, blocked });
}
