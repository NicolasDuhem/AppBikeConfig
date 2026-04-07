import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { sql } from '@/lib/db';
import { buildCpqCombinationsDetailed, mapCsvOptionNameToCanonical } from '@/lib/cpq';
import type { SkuRule } from '@/lib/types';

export async function GET(request: Request) {
  let runId = 0;
  try {
    const auth = await requireApiRole('builder.use');
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    runId = Number(searchParams.get('run_id') || 0);
    if (!runId) return NextResponse.json({ success: false, phase: 'generation_validation', error: 'run_id is required' }, { status: 400 });

    const runRows = await sql`select * from cpq_import_runs where id = ${runId} limit 1` as any[];
    if (!runRows.length) return NextResponse.json({ success: false, phase: 'generation_validation', error: 'Import run not found' }, { status: 404 });
    const run = runRows[0];

    await sql`update cpq_import_runs set current_phase = 'generating_combinations', error_message = null, error_stack = null where id = ${runId}`;
    console.info('[CPQ_GENERATE] start', { runId, fileName: run.file_name });

    const importRows = await sql`
      select row_number, digit_position, option_name, code_value
      from cpq_import_rows
      where import_run_id = ${runId}
        and status = 'imported'
      order by row_number
    ` as Array<{ row_number: number; digit_position: number; option_name: string; code_value: string }>;

    if (!importRows.length) {
      const diagnostics = { activeRowsConsidered: 0, digitGroups: [], combinationsProduced: 0, reason: 'no_imported_rows_for_run' };
      await sql`
        update cpq_import_runs
        set current_phase = 'generation_failed',
            status = 'failed',
            error_message = 'No imported rows available for this run',
            error_stack = ${JSON.stringify(diagnostics)},
            failed_at = now()
        where id = ${runId}
      `;
      return NextResponse.json({ success: false, phase: 'generation_validation', error: 'No imported rows available for this run', diagnostics }, { status: 400 });
    }

    const scopedKeySet = new Set(importRows.map((row) => `${Number(row.digit_position)}|${String(row.code_value || (Number(row.digit_position) === 0 ? '-' : '')).toUpperCase()}|${String(mapCsvOptionNameToCanonical(row.option_name) || row.option_name).toLowerCase()}`));
    const activeRules = await sql`
      select id, digit_position, option_name, code_value, choice_value, description_element, is_active, deactivated_at, deactivation_reason
      from sku_rules
      where is_active = true
      order by id desc
    ` as SkuRule[];

    const scopedRulesByKey = new Map<string, SkuRule>();
    for (const rule of activeRules) {
      const canonicalOption = mapCsvOptionNameToCanonical(rule.option_name) || rule.option_name;
      const scopedKey = `${Number(rule.digit_position)}|${String(rule.code_value || '').toUpperCase()}|${String(canonicalOption).toLowerCase()}`;
      if (!scopedKeySet.has(scopedKey)) continue;
      if (!scopedRulesByKey.has(scopedKey)) {
        scopedRulesByKey.set(scopedKey, { ...rule, option_name: canonicalOption });
      }
    }
    const scopedRules = Array.from(scopedRulesByKey.values()).sort((a, b) => Number(a.digit_position) - Number(b.digit_position) || String(a.code_value).localeCompare(String(b.code_value)));

    const { rows, diagnostics } = buildCpqCombinationsDetailed(scopedRules, {
      selectedLine: run.selected_line,
      electricType: run.electric_type,
      isSpecial: run.is_special,
      specialEditionName: run.special_edition_name || undefined,
      character17: run.character_17,
      fileName: run.file_name
    });

    console.info('[CPQ_GENERATE] scoped rows', { runId, importedRows: importRows.length, activeRowsConsidered: diagnostics.activeRowsConsidered });
    console.info('[CPQ_GENERATE] digit groups', { runId, digitGroups: diagnostics.digitGroups });
    if (diagnostics.skippedRows.length) {
      console.warn('[CPQ_GENERATE] skipped rows', { runId, skippedRows: diagnostics.skippedRows.slice(0, 20), skippedCount: diagnostics.skippedRows.length });
    }
    console.info('[CPQ_GENERATE] completed', { runId, combinationsProduced: diagnostics.combinationsProduced });

    await sql`
      update cpq_import_runs
      set current_phase = 'generation_completed',
          status = 'completed',
          error_message = null,
          error_stack = null,
          completed_at = now()
      where id = ${runId}
    `;

    return NextResponse.json({ success: true, phase: 'generation_completed', run, rows, diagnostics });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected generation error';
    const stack = error instanceof Error ? error.stack : null;
    console.error('[CPQ_GENERATE] failed', { runId, message });
    if (runId) {
      await sql`
        update cpq_import_runs
        set current_phase = 'generation_failed',
            status = 'failed',
            error_message = ${message},
            error_stack = ${stack},
            failed_at = now()
        where id = ${runId}
      `;
    }
    return NextResponse.json({ success: false, phase: 'generation_failed', error: message }, { status: 500 });
  }
}
