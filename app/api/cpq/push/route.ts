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
  for (const row of rows) {
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
        ${runId || null}, ${String(row['CPQRuleset'] || '')}, ${String(row['ProductAssist'] || '')}, ${String(row['ProductFamily'] || '')},
        ${String(row['ProductLine'] || '')}, ${String(row['ProductModel'] || '')}, ${String(row['ProductType'] || '')},
        ${brakeMode === 'reverse' ? 'yes' : 'no'}, ${brakeMode === 'non_reverse' ? 'yes' : 'no'},
        ${String(row['SKU code'] || '')}, ${String(row['Description'] || '')}, ${String(row['HandlebarType'] || '')}, ${String(row['Speeds'] || '')}, ${String(row['MudguardsandRack'] || '')}, ${String(row['Territory'] || '')},
        ${String(row['MainFrameColour'] || '')}, ${String(row['RearFrameColour'] || '')}, ${String(row['FrontCarrierBlock'] || '')}, ${String(row['Lighting'] || '')}, ${String(row['SaddleHeight'] || '')},
        ${String(row['GearRatio'] || '')}, ${String(row['Saddle'] || '')}, ${String(row['Tyre'] || '')}, ${String(row['Brakes'] || '')}, ${String(row['Pedals'] || '')},
        ${String(row['Saddlebag'] || '')}, ${String(row['Suspension'] || '')}, ${String(row['BikeType'] || '')}, ${String(row['Toolkit'] || '')}, ${String(row['SaddleLight'] || '')},
        ${String(row['ConfigCode'] || '')}, ${String(row['OptionBox'] || '')}, ${String(row['FrameMaterial'] || '')}, ${String(row['FrameSet'] || '')}, ${String(row['ComponentColour'] || '')},
        ${String(row['OnBikeAccessories'] || '')}, ${String(row['HandlebarStemColour'] || '')}, ${String(row['HandlebarPinColour'] || '')}, ${String(row['FrontFrameColour'] || '')},
        ${String(row['FrontForkColour'] || '')}, ${String(row['Position29'] || '')}, ${String(row['Position30'] || '')}, ${auth.user.id}
      )
    `;
    pushed += 1;
  }

  return NextResponse.json({ ok: true, pushed });
}
