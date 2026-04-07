import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { sql } from '@/lib/db';
import { buildCpqCombinations } from '@/lib/cpq';
import type { SkuRule } from '@/lib/types';

export async function GET(request: Request) {
  const auth = await requireApiRole('builder.use');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const runId = Number(searchParams.get('run_id') || 0);
  if (!runId) return NextResponse.json({ error: 'run_id is required' }, { status: 400 });

  const runRows = await sql`select * from cpq_import_runs where id = ${runId} limit 1` as any[];
  if (!runRows.length) return NextResponse.json({ error: 'Import run not found' }, { status: 404 });
  const run = runRows[0];

  const rules = await sql`
    select id, digit_position, option_name, code_value, choice_value, description_element, is_active, deactivated_at, deactivation_reason
    from sku_rules
    where is_active = true
    order by digit_position, option_name, choice_value
  ` as SkuRule[];

  const generated = buildCpqCombinations(rules, {
    selectedLine: run.selected_line,
    electricType: run.electric_type,
    isSpecial: run.is_special,
    specialEditionName: run.special_edition_name || undefined,
    character17: run.character_17,
    fileName: run.file_name
  });

  return NextResponse.json({ run, rows: generated });
}
