import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { sql } from '@/lib/db';

export async function POST(request: Request) {
  const auth = await requireApiRole('builder.push');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const brakeMode = String(body.brakeMode || '');
  const runId = Number(body.runId || 0);

  if (!rows.length) return NextResponse.json({ error: 'No selected rows to push' }, { status: 400 });
  if (!['reverse', 'non_reverse'].includes(brakeMode)) return NextResponse.json({ error: 'brakeMode is required' }, { status: 400 });

  let pushed = 0;
  let updatedExisting = 0;
  const skippedDuplicates: string[] = [];

  for (const row of rows) {
    const skuCode = String(row['SKU code'] || '').trim();
    const cpqRuleset = String(row['CPQRuleset'] || '').trim();
    if (!skuCode || !cpqRuleset) continue;

    await sql`
      insert into cpq_products (
        import_run_id, cpq_ruleset, product_assist, product_family, product_line, product_model, product_type,
        brake_reverse, brake_non_reverse, sku_code, description, handlebar_type, speeds, mudguardsandrack, territory,
        mainframecolour, rearframecolour, frontcarrierblock, lighting, saddleheight, gearratio, saddle, tyre, brakes,
        pedals, saddlebag, suspension, biketype, toolkit, saddlelight, configcode, optionbox, framematerial, frameset,
        componentcolour, onbikeaccessories, handlebarstemcolour, handlebarpincolour, frontframecolour, frontforkcolour,
        position29, position30, created_by
      )
      values (
        ${runId || null}, ${cpqRuleset}, ${String(row['ProductAssist'] || '')}, ${String(row['ProductFamily'] || '')},
        ${String(row['ProductLine'] || '')}, ${String(row['ProductModel'] || '')}, ${String(row['ProductType'] || '')},
        ${brakeMode === 'reverse' ? 'yes' : 'no'}, ${brakeMode === 'non_reverse' ? 'yes' : 'no'},
        ${skuCode}, ${String(row['Description'] || '')}, ${String(row['HandlebarType'] || '')}, ${String(row['Speeds'] || '')}, ${String(row['MudguardsandRack'] || '')}, ${String(row['Territory'] || '')},
        ${String(row['MainFrameColour'] || '')}, ${String(row['RearFrameColour'] || '')}, ${String(row['FrontCarrierBlock'] || '')}, ${String(row['Lighting'] || '')}, ${String(row['SaddleHeight'] || '')},
        ${String(row['GearRatio'] || '')}, ${String(row['Saddle'] || '')}, ${String(row['Tyre'] || '')}, ${String(row['Brakes'] || '')}, ${String(row['Pedals'] || '')},
        ${String(row['Saddlebag'] || '')}, ${String(row['Suspension'] || '')}, ${String(row['BikeType'] || '')}, ${String(row['Toolkit'] || '')}, ${String(row['SaddleLight'] || '')},
        ${String(row['ConfigCode'] || '')}, ${String(row['OptionBox'] || '')}, ${String(row['FrameMaterial'] || '')}, ${String(row['FrameSet'] || '')}, ${String(row['ComponentColour'] || '')},
        ${String(row['OnBikeAccessories'] || '')}, ${String(row['HandlebarStemColour'] || '')}, ${String(row['HandlebarPinColour'] || '')}, ${String(row['FrontFrameColour'] || '')},
        ${String(row['FrontForkColour'] || '')}, ${String(row['Position29'] || '')}, ${String(row['Position30'] || '')}, ${auth.user.id}
      )
    `;

    const existingActive = await sql`
      select id from cpq_sku_rules
      where lower(sku_code) = lower(${skuCode})
        and lower(cpq_ruleset) = lower(${cpqRuleset})
        and brake_type = ${brakeMode}
        and is_active = true
      limit 1
    ` as any[];

    let cpqRuleId = 0;
    if (existingActive.length) {
      cpqRuleId = Number(existingActive[0].id);
      updatedExisting += 1;
      skippedDuplicates.push(`${skuCode} (${cpqRuleset})`);
      await sql`
        update cpq_sku_rules
        set bike_type = ${String(row['BikeType'] || '')},
            handlebar = ${String(row['HandlebarType'] || '')},
            speed = ${String(row['Speeds'] || '')},
            rack = ${String(row['MudguardsandRack'] || '')},
            colour = ${String(row['MainFrameColour'] || '')},
            light = ${String(row['Lighting'] || '')},
            seatpost_length = ${String(row['SaddleHeight'] || '')},
            saddle = ${String(row['Saddle'] || '')},
            description = ${String(row['Description'] || '')},
            updated_at = now()
        where id = ${cpqRuleId}
      `;
    } else {
      const inserted = await sql`
        insert into cpq_sku_rules (sku_code, cpq_ruleset, brake_type, bike_type, handlebar, speed, rack, colour, light, seatpost_length, saddle, description, created_by)
        values (
          ${skuCode}, ${cpqRuleset}, ${brakeMode}, ${String(row['BikeType'] || '')}, ${String(row['HandlebarType'] || '')}, ${String(row['Speeds'] || '')}, ${String(row['MudguardsandRack'] || '')},
          ${String(row['MainFrameColour'] || '')}, ${String(row['Lighting'] || '')}, ${String(row['SaddleHeight'] || '')}, ${String(row['Saddle'] || '')}, ${String(row['Description'] || '')}, ${auth.user.id}
        )
        returning id
      ` as any[];
      cpqRuleId = Number(inserted[0].id);
      pushed += 1;
    }

    const cpqCountries = await sql`select id, brake_type from cpq_countries` as any[];
    for (const country of cpqCountries) {
      await sql`
        insert into cpq_availability (cpq_sku_rule_id, cpq_country_id, available, updated_at)
        values (${cpqRuleId}, ${country.id}, ${false}, now())
        on conflict (cpq_sku_rule_id, cpq_country_id) do nothing
      `;
    }
  }

  return NextResponse.json({ ok: true, pushed, updatedExisting, duplicatePolicy: 'Existing active rows with same SKU + ruleset + brake_type are updated; no conflicting active duplicate is inserted.', skippedDuplicates });
}
