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
    select
      r.id as cpq_rule_id,
      r.sku_code,
      r.cpq_ruleset,
      r.brake_type,
      r.handlebar,
      r.speed,
      r.rack,
      r.bike_type,
      r.colour,
      r.light,
      r.seatpost_length,
      r.saddle,
      r.description,
      coalesce(r.bc_status, '') as bc_status,
      p.product_assist,
      p.product_family,
      p.product_line,
      p.product_model,
      p.product_type,
      p.handlebar_type,
      p.speeds,
      p.mudguardsandrack as mudguards_and_rack,
      p.territory,
      p.mainframecolour as main_frame_colour,
      p.rearframecolour as rear_frame_colour,
      p.frontcarrierblock as front_carrier_block,
      p.lighting,
      p.saddleheight as saddle_height,
      p.gearratio as gear_ratio,
      p.tyre,
      p.brakes,
      p.pedals,
      p.saddlebag,
      p.suspension,
      p.biketype,
      p.toolkit,
      p.saddlelight as saddle_light,
      p.configcode as config_code,
      p.optionbox as option_box,
      p.framematerial as frame_material,
      p.frameset as frame_set,
      p.componentcolour as component_colour,
      p.onbikeaccessories as on_bike_accessories,
      p.handlebarstemcolour as handlebar_stem_colour,
      p.handlebarpincolour as handlebar_pin_colour,
      p.frontframecolour as front_frame_colour,
      p.frontforkcolour as front_fork_colour
    from cpq_sku_rules r
    left join cpq_products p on p.id = r.cpq_product_id
    where r.is_active = true
    order by r.cpq_ruleset, r.bike_type nulls last, r.sku_code
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
