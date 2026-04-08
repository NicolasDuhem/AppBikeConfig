import { NextResponse } from 'next/server';

/**
 * @deprecated Legacy compatibility API path.
 * New product work must target CPQ canonical APIs.
 */
import { sql } from '@/lib/db';
import { requireApiRole } from '@/lib/api-auth';
import { writeAuditLog } from '@/lib/audit';
import { LEGACY_PATH_KEYS, trackLegacyPathInvocation } from '@/lib/deprecation-telemetry';

export async function POST(request: Request) {
  const auth = await requireApiRole('builder.push');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const rows = Array.isArray(body.rows) ? body.rows : [];
  await trackLegacyPathInvocation({ pathKey: LEGACY_PATH_KEYS.builderPush, route: '/api/builder-push', method: 'POST', userId: auth.user.id, details: { rowCount: rows.length } });

  let pushed = 0;

  for (const row of rows) {
    const sku = String(row.sku_code || '').trim();
    if (!sku) continue;

    const inserted = await sql`
      insert into products (sku_code, handlebar, speed, rack, bike_type, colour, light, seatpost_length, saddle, description)
      values (${sku}, ${String(row.handlebar || '')}, ${String(row.speed || '')}, ${String(row.rack || '')}, ${String(row.bike_type || '')}, ${String(row.colour || '')}, ${String(row.light || '')}, ${String(row.seatpost_length || '')}, ${String(row.saddle || '')}, ${String(row.description || '')})
      on conflict (sku_code) do update
      set handlebar = excluded.handlebar,
          speed = excluded.speed,
          rack = excluded.rack,
          bike_type = excluded.bike_type,
          colour = excluded.colour,
          light = excluded.light,
          seatpost_length = excluded.seatpost_length,
          saddle = excluded.saddle,
          description = excluded.description,
          updated_at = now()
      returning id
    ` as any[];
    pushed += 1;
    const productId = Number(inserted[0].id);
    const countries = await sql`select id from countries` as any[];
    for (const c of countries) {
      await sql`insert into availability (product_id, country_id, available) values (${productId}, ${c.id}, false) on conflict (product_id, country_id) do nothing`;
    }
  }

  await writeAuditLog({
    userId: auth.user.id,
    actionKey: 'builder.push',
    entityType: 'builder_push',
    newData: { pushed, rowCount: rows.length }
  });

  return NextResponse.json({ ok: true, pushed });
}
