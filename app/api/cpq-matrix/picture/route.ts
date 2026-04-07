import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { sql } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { CPQ_BDAM_PICTURE_PICKER_FLAG_KEY, isFeatureEnabled } from '@/lib/feature-flags';

export async function POST(request: Request) {
  const auth = await requireApiRole('matrix.update.single');
  if (auth instanceof NextResponse) return auth;

  const enabled = await isFeatureEnabled(CPQ_BDAM_PICTURE_PICKER_FLAG_KEY);
  if (!enabled) return NextResponse.json({ error: 'Feature disabled' }, { status: 404 });

  const body = await request.json();
  const cpqRuleId = Number(body.cpq_rule_id || 0);
  const assetUrl = String(body.asset_url || '').trim();
  const pngUrlRaw = String(body.png_url || '').trim();
  const assetIdRaw = String(body.asset_id || '').trim();
  const notesRaw = String(body.notes || '').trim();

  if (!cpqRuleId) return NextResponse.json({ error: 'cpq_rule_id is required' }, { status: 400 });
  if (!assetUrl) return NextResponse.json({ error: 'asset_url is required' }, { status: 400 });

  const target = await sql`select id from cpq_sku_rules where id = ${cpqRuleId} and is_active = true limit 1` as any[];
  if (!target.length) return NextResponse.json({ error: 'CPQ row not found' }, { status: 404 });

  const existing = await sql`select * from cpq_product_assets where cpq_sku_rule_id = ${cpqRuleId} limit 1` as any[];
  const oldData = existing[0] || null;

  const saved = await sql`
    insert into cpq_product_assets (
      cpq_sku_rule_id,
      asset_url,
      png_url,
      asset_id,
      notes,
      selected_by,
      selected_at,
      updated_by,
      updated_at
    )
    values (
      ${cpqRuleId},
      ${assetUrl},
      ${pngUrlRaw || null},
      ${assetIdRaw || null},
      ${notesRaw || null},
      ${auth.user.id},
      now(),
      ${auth.user.id},
      now()
    )
    on conflict (cpq_sku_rule_id)
    do update set
      asset_url = excluded.asset_url,
      png_url = excluded.png_url,
      asset_id = excluded.asset_id,
      notes = excluded.notes,
      selected_by = excluded.selected_by,
      selected_at = excluded.selected_at,
      updated_by = excluded.updated_by,
      updated_at = now()
    returning cpq_sku_rule_id, asset_url, png_url, asset_id, notes, selected_at
  ` as any[];

  await writeAuditLog({
    userId: auth.user.id,
    actionKey: 'matrix.update.single',
    entityType: 'cpq_product_asset',
    entityId: String(cpqRuleId),
    oldData,
    newData: saved[0]
  });

  return NextResponse.json({ ok: true, row: saved[0] });
}
