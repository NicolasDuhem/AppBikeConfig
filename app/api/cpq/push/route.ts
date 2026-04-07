import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { sql } from '@/lib/db';

function pick(row: any, ...keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null) return String(value);
  }
  return '';
}

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
    const skuCode = pick(row, 'SKU code').trim();
    const cpqRuleset = pick(row, 'CPQRuleset').trim();
    if (!skuCode || !cpqRuleset) continue;

    const cpqProductInsert = await sql`
      insert into cpq_products (
        import_run_id, cpq_ruleset, product_assist, product_family, product_line, product_model, product_type,
        brake_reverse, brake_non_reverse, sku_code, description, handlebar_type, speeds, mudguardsandrack, territory,
        mainframecolour, rearframecolour, frontcarrierblock, lighting, saddleheight, gearratio, saddle, tyre, brakes,
        pedals, saddlebag, suspension, biketype, toolkit, saddlelight, configcode, optionbox, framematerial, frameset,
        componentcolour, onbikeaccessories, handlebarstemcolour, handlebarpincolour, frontframecolour, frontforkcolour,
        position29, position30, created_by
      )
      values (
        ${runId || null}, ${cpqRuleset}, ${pick(row, 'ProductAssist')}, ${pick(row, 'ProductFamily')},
        ${pick(row, 'ProductLine')}, ${pick(row, 'ProductModel')}, ${pick(row, 'ProductType')},
        ${brakeMode === 'reverse' ? 'yes' : 'no'}, ${brakeMode === 'non_reverse' ? 'yes' : 'no'},
        ${skuCode}, ${pick(row, 'Description')}, ${pick(row, 'HandlebarType')}, ${pick(row, 'Speeds')}, ${pick(row, 'MudguardsAndRack', 'MudguardsandRack')}, ${pick(row, 'Territory')},
        ${pick(row, 'MainFrameColour')}, ${pick(row, 'RearFrameColour')}, ${pick(row, 'FrontCarrierBlock')}, ${pick(row, 'Lighting')}, ${pick(row, 'SaddleHeight')},
        ${pick(row, 'GearRatio')}, ${pick(row, 'Saddle')}, ${pick(row, 'Tyre')}, ${pick(row, 'Brakes')}, ${pick(row, 'Pedals')},
        ${pick(row, 'Saddlebag', 'SaddleBag')}, ${pick(row, 'Suspension')}, ${pick(row, 'BikeType')}, ${pick(row, 'Toolkit')}, ${pick(row, 'SaddleLight')},
        ${pick(row, 'ConfigCode')}, ${pick(row, 'OptionBox')}, ${pick(row, 'FrameMaterial')}, ${pick(row, 'FrameSet')}, ${pick(row, 'ComponentColour')},
        ${pick(row, 'OnBikeAccessories')}, ${pick(row, 'HandlebarStemColour')}, ${pick(row, 'HandlebarPinColour')}, ${pick(row, 'FrontFrameColour')},
        ${pick(row, 'FrontForkColour')}, ${pick(row, 'Position29')}, ${pick(row, 'Position30')}, ${auth.user.id}
      )
      returning id
    ` as any[];
    const cpqProductId = Number(cpqProductInsert[0].id);

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
        set cpq_product_id = ${cpqProductId},
            bike_type = ${pick(row, 'BikeType')},
            handlebar = ${pick(row, 'HandlebarType')},
            speed = ${pick(row, 'Speeds')},
            rack = ${pick(row, 'MudguardsAndRack', 'MudguardsandRack')},
            colour = ${pick(row, 'MainFrameColour')},
            light = ${pick(row, 'Lighting')},
            seatpost_length = ${pick(row, 'SaddleHeight')},
            saddle = ${pick(row, 'Saddle')},
            description = ${pick(row, 'Description')},
            updated_at = now()
        where id = ${cpqRuleId}
      `;
    } else {
      const inserted = await sql`
        insert into cpq_sku_rules (cpq_product_id, sku_code, cpq_ruleset, brake_type, bike_type, handlebar, speed, rack, colour, light, seatpost_length, saddle, description, created_by)
        values (
          ${cpqProductId}, ${skuCode}, ${cpqRuleset}, ${brakeMode}, ${pick(row, 'BikeType')}, ${pick(row, 'HandlebarType')}, ${pick(row, 'Speeds')}, ${pick(row, 'MudguardsAndRack', 'MudguardsandRack')},
          ${pick(row, 'MainFrameColour')}, ${pick(row, 'Lighting')}, ${pick(row, 'SaddleHeight')}, ${pick(row, 'Saddle')}, ${pick(row, 'Description')}, ${auth.user.id}
        )
        returning id
      ` as any[];
      cpqRuleId = Number(inserted[0].id);
      pushed += 1;
    }

    const cpqCountries = await sql`select id from cpq_countries` as any[];
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
