import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireApiLogin, requireApiRole } from '@/lib/api-auth';
import { writeAuditLog } from '@/lib/audit';
import { getCpqCountries, upsertCpqMatrixProduct } from '@/lib/cpq-matrix-service';

export async function GET() {
  const auth = await requireApiLogin();
  if (auth instanceof NextResponse) return auth;

  const countries = await getCpqCountries();
  const rulesets = await sql`select distinct cpq_ruleset from cpq_sku_rules where is_active = true and cpq_ruleset <> '' order by cpq_ruleset`;
  const products = await sql`
    select id as cpq_rule_id, sku_code, cpq_ruleset, brake_type, handlebar, speed, rack, bike_type, colour, light, seatpost_length, saddle, description, coalesce(bc_status, '') as bc_status
    from cpq_sku_rules
    where is_active = true
    order by cpq_ruleset, bike_type nulls last, sku_code
  `;
  const availabilityRows = await sql`
    select a.cpq_sku_rule_id, c.country, c.brake_type as country_brake_type, a.available
    from cpq_availability a
    join cpq_countries c on c.id = a.cpq_country_id
  `;

  const availabilityMap = new Map<number, Record<string, boolean>>();
  for (const row of availabilityRows as any[]) {
    const key = Number(row.cpq_sku_rule_id);
    availabilityMap.set(key, { ...(availabilityMap.get(key) || {}), [row.country]: !!row.available });
  }

  const rows = (products as any[]).map((p) => ({ ...p, id: Number(p.cpq_rule_id), availability: availabilityMap.get(Number(p.cpq_rule_id)) || {} }));
  return NextResponse.json({ countries, rows, rulesets: (rulesets as any[]).map((r) => r.cpq_ruleset) });
}

export async function POST(request: Request) {
  const auth = await requireApiRole('matrix.update.single');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const result = await upsertCpqMatrixProduct(body.product || {}, body.availability || {});
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await writeAuditLog({
    userId: auth.user.id,
    actionKey: 'matrix.update.single',
    entityType: 'cpq_sku_rule',
    entityId: String(result.cpqRuleId),
    oldData: result.oldProduct,
    newData: { product: result.newProduct, availability: body.availability || {} }
  });

  return NextResponse.json({ ok: true, id: result.cpqRuleId });
}
