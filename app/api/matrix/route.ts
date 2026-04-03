import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireApiLogin, requireApiRole } from '@/lib/api-auth';
import { writeAuditLog } from '@/lib/audit';
import { getCountries, upsertMatrixProduct } from '@/lib/matrix-service';

export async function GET() {
  const auth = await requireApiLogin();
  if (auth instanceof NextResponse) return auth;

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
  const auth = await requireApiRole('matrix.update.single');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const product = body.product || {};
  const availability = body.availability || {};

  const result = await upsertMatrixProduct(product, availability);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await writeAuditLog({
    userId: auth.user.id,
    actionKey: 'matrix.update.single',
    entityType: 'product',
    entityId: String(result.productId),
    oldData: result.oldProduct,
    newData: { product: result.newProduct, availability }
  });

  return NextResponse.json({ ok: true, id: result.productId });
}
