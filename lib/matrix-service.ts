import { sql } from '@/lib/db';

export type MatrixProductInput = {
  id?: number;
  sku_code?: string;
  handlebar?: string;
  speed?: string;
  rack?: string;
  bike_type?: string;
  colour?: string;
  light?: string;
  seatpost_length?: string;
  saddle?: string;
  description?: string;
  bc_status?: 'ok' | 'nok' | '';
};

export async function getCountries() {
  return await sql`select id, country, region from countries order by region, country`;
}

export async function upsertMatrixProduct(product: MatrixProductInput, availability: Record<string, boolean>) {
  const id = Number(product.id || 0);
  const skuCode = String(product.sku_code || '').trim();
  if (!skuCode) {
    return { ok: false as const, error: 'sku_code is required' };
  }

  const oldProduct = id ? ((await sql`select * from products where id = ${id}` as any[])[0] || null) : null;
  let productId = id;

  try {
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
          bc_status = ${String(product.bc_status || '')},
          updated_at = now()
        where id = ${productId}
        returning id
      ` as any[];
      if (!updated.length) {
        return { ok: false as const, error: `Product ${productId} not found` };
      }
      productId = Number(updated[0].id);
    } else {
      const inserted = await sql`
        insert into products (sku_code, handlebar, speed, rack, bike_type, colour, light, seatpost_length, saddle, description, bc_status)
        values (${skuCode}, ${String(product.handlebar || '')}, ${String(product.speed || '')}, ${String(product.rack || '')}, ${String(product.bike_type || '')}, ${String(product.colour || '')}, ${String(product.light || '')}, ${String(product.seatpost_length || '')}, ${String(product.saddle || '')}, ${String(product.description || '')}, ${String(product.bc_status || '')})
        returning id
      ` as any[];
      productId = Number(inserted[0].id);
    }
  } catch (error: any) {
    if (String(error?.message || '').toLowerCase().includes('products_sku_code_key')) {
      return { ok: false as const, error: `sku_code '${skuCode}' already exists` };
    }
    return { ok: false as const, error: 'Failed to save product row' };
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

  const newProduct = (await sql`select * from products where id = ${productId}` as any[])[0];
  return { ok: true as const, productId, oldProduct, newProduct };
}


export async function updateMatrixBcStatus(updates: Array<{ productId: number; bcStatus: 'ok' | 'nok' }>) {
  for (const update of updates) {
    await sql`
      update products
      set bc_status = ${update.bcStatus},
          updated_at = now()
      where id = ${update.productId}
    `;
  }
}
