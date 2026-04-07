import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { sql } from '@/lib/db';

export async function GET() {
  const auth = await requireApiRole('builder.use');
  if (auth instanceof NextResponse) return auth;

  const [digitConfigs, dependencyRules, availableDigits] = await Promise.all([
    sql`select id, digit_position, option_name, is_required, selection_mode, is_active from sku_digit_option_config order by digit_position`,
    sql`select id, source_digit_position, target_digit_position, rule_type, active, sort_order, notes from sku_generation_dependency_rules order by sort_order, source_digit_position, target_digit_position`,
    sql`select distinct digit_position, option_name from cpq_import_rows where status = 'imported' and digit_position between 1 and 30 and coalesce(is_active, true) = true order by digit_position`
  ]);

  return NextResponse.json({ digitConfigs, dependencyRules, availableDigits });
}

export async function PATCH(request: Request) {
  const auth = await requireApiRole('setup.manage');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const digitConfigs = Array.isArray(body.digitConfigs) ? body.digitConfigs : [];
  const dependencyRules = Array.isArray(body.dependencyRules) ? body.dependencyRules : [];

  for (const cfg of digitConfigs) {
    const digitPosition = Number(cfg.digit_position);
    if (!digitPosition || digitPosition < 1 || digitPosition > 30) continue;
    const optionName = String(cfg.option_name || '').trim();
    if (!optionName) continue;
    const selectionMode = String(cfg.selection_mode) === 'multi' ? 'multi' : 'single';

    await sql`
      insert into sku_digit_option_config (digit_position, option_name, is_required, selection_mode, is_active, updated_at)
      values (${digitPosition}, ${optionName}, ${!!cfg.is_required}, ${selectionMode}, ${cfg.is_active !== false}, now())
      on conflict (digit_position) do update
      set option_name = excluded.option_name,
          is_required = excluded.is_required,
          selection_mode = excluded.selection_mode,
          is_active = excluded.is_active,
          updated_at = now()
    `;
  }

  await sql`delete from sku_generation_dependency_rules`;
  for (const rule of dependencyRules) {
    const sourceDigitPosition = Number(rule.source_digit_position);
    const targetDigitPosition = Number(rule.target_digit_position);
    if (!sourceDigitPosition || !targetDigitPosition) continue;
    await sql`
      insert into sku_generation_dependency_rules (source_digit_position, target_digit_position, rule_type, active, sort_order, notes, updated_at)
      values (
        ${sourceDigitPosition},
        ${targetDigitPosition},
        ${String(rule.rule_type || 'match_code')},
        ${rule.active !== false},
        ${Number(rule.sort_order || 0)},
        ${String(rule.notes || '').trim() || null},
        now()
      )
      on conflict (source_digit_position, target_digit_position, rule_type) do update
      set active = excluded.active,
          sort_order = excluded.sort_order,
          notes = excluded.notes,
          updated_at = now()
    `;
  }

  return NextResponse.json({ ok: true });
}
