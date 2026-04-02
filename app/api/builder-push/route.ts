import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: Request) {
  const body = await request.json();
  const rows = Array.isArray(body.rows) ? body.rows : [];
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
    `;
    pushed += 1;
    const productId = Number(inserted[0].id);
    const countries = await sql`select id from countries`;
    for (const c of countries as any[]) {
      await sql`insert into availability (product_id, country_id, available) values (${productId}, ${c.id}, false) on conflict (product_id, country_id) do nothing`;
    }
  }

  return NextResponse.json({ ok: true, pushed });
}
