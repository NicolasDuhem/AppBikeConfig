import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

async function getCountries() {
  return await sql`select id, country, region from countries order by region, country`;
}

export async function GET() {
  const countries = await getCountries();
  const products = await sql`
    select id, sku_code, handlebar, speed, rack, bike_type, colour, light, seatpost_length, saddle, description
    from products
    order by bike_type nulls last, sku_code
  `;
  const availabilityRows = await sql`
    select a.product_id, c.country, a.available
    from availability a
    join countries c on c.id = a.country_id
  `;

  const availabilityMap = new Map<number, Record<string, boolean>>();
  for (const row of availabilityRows as any[]) {
    const key = Number(row.product_id);
    availabilityMap.set(key, { ...(availabilityMap.get(key) || {}), [row.country]: !!row.available });
  }

  const rows = (products as any[]).map((p) => ({ ...p, availability: availabilityMap.get(Number(p.id)) || {} }));
  return NextResponse.json({ countries, rows });
}

export async function POST(request: Request) {
  const body = await request.json();
  const product = body.product || {};
  const availability = body.availability || {};
  const id = Number(product.id || 0);
  const skuCode = String(product.sku_code || '').trim();
  if (!skuCode) return NextResponse.json({ error: 'sku_code is required' }, { status: 400 });

  let productId = id;
  if (productId) {
    const updated = await sql`
      update products set
        sku_code = ${skuCode},
        handlebar = ${String(product.handlebar || '')},
        speed = ${String(product.speed || '')},
        rack = ${String(product.rack || '')},
        bike_type = ${String(product.bike_type || '')},
        colour = ${String(product.colour || '')},
        light = ${String(product.light || '')},
        seatpost_length = ${String(product.seatpost_length || '')},
        saddle = ${String(product.saddle || '')},
        description = ${String(product.description || '')},
        updated_at = now()
      where id = ${productId}
      returning id
    `;
    productId = Number(updated[0].id);
  } else {
    const inserted = await sql`
      insert into products (sku_code, handlebar, speed, rack, bike_type, colour, light, seatpost_length, saddle, description)
      values (${skuCode}, ${String(product.handlebar || '')}, ${String(product.speed || '')}, ${String(product.rack || '')}, ${String(product.bike_type || '')}, ${String(product.colour || '')}, ${String(product.light || '')}, ${String(product.seatpost_length || '')}, ${String(product.saddle || '')}, ${String(product.description || '')})
      returning id
    `;
    productId = Number(inserted[0].id);
  }

  const countries = await getCountries();
  for (const country of countries as any[]) {
    if (!(country.country in availability)) continue;
    await sql`
      insert into availability (product_id, country_id, available, updated_at)
      values (${productId}, ${country.id}, ${!!availability[country.country]}, now())
      on conflict (product_id, country_id)
      do update set available = excluded.available, updated_at = now()
    `;
  }

  return NextResponse.json({ ok: true, id: productId });
}
