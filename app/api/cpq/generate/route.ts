import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { sql } from '@/lib/db';
import { buildCpqCombinationsDetailed, CPQ_COLUMNS, mapOptionNameToCanonical, normalizeCharacter17 } from '@/lib/cpq-core';
import { trackLegacyPathInvocation } from '@/lib/deprecation-telemetry';

type SelectedDigitChoice = {
  digitPosition: number;
  optionName: string;
  codeValue: string;
  choiceValue: string;
  cpqImportRowId: number | null;
};

type DigitConfig = { digit_position: number; option_name: string; is_required: boolean; selection_mode: 'single' | 'multi' };
type DependencyRule = { source_digit_position: number; target_digit_position: number; rule_type: 'match_code'; active: boolean; sort_order: number };

function buildRowsFromSelectedChoices(payload: any, digitConfigs: DigitConfig[], dependencyRules: DependencyRule[]) {
  const cpqRuleset = String(payload?.cpqRuleset || '').trim();
  const productAssist = String(payload?.productAssist || '').trim();
  const productFamily = String(payload?.productFamily || '').trim();
  const productLine = String(payload?.productLine || '').trim();
  const productType = String(payload?.productType || '').trim();
  const productModel = String(payload?.productModel || '').trim();
  const selectedChoices = Array.isArray(payload?.selectedDigitChoices) ? payload.selectedDigitChoices as SelectedDigitChoice[] : [];

  if (!cpqRuleset || !productAssist || !productFamily || !productLine || !productType || !productModel) {
    return { error: 'cpqRuleset, productAssist, productFamily, productLine, productType and productModel are required' };
  }

  const grouped = new Map<number, SelectedDigitChoice[]>();
  for (const rawChoice of selectedChoices) {
    const digitPosition = Number(rawChoice.digitPosition);
    if (!digitPosition || digitPosition < 1 || digitPosition > 30) continue;
    const optionName = mapOptionNameToCanonical(String(rawChoice.optionName || '').trim()) || String(rawChoice.optionName || '').trim();
    const choice: SelectedDigitChoice = {
      digitPosition,
      optionName,
      codeValue: String(rawChoice.codeValue || '').trim().toUpperCase(),
      choiceValue: String(rawChoice.choiceValue || '').trim(),
      cpqImportRowId: rawChoice.cpqImportRowId ? Number(rawChoice.cpqImportRowId) : null
    };
    const bucket = grouped.get(digitPosition) || [];
    if (!bucket.some((item) => item.codeValue === choice.codeValue)) bucket.push(choice);
    grouped.set(digitPosition, bucket);
  }

  const configByDigit = new Map<number, DigitConfig>();
  digitConfigs.forEach((cfg) => configByDigit.set(Number(cfg.digit_position), cfg));

  for (const cfg of digitConfigs) {
    const selected = grouped.get(Number(cfg.digit_position)) || [];
    if (cfg.is_required && !selected.length) {
      return { error: `Digit ${cfg.digit_position} (${cfg.option_name}) is required.` };
    }
    if (cfg.selection_mode === 'single' && selected.length > 1) {
      return { error: `Digit ${cfg.digit_position} (${cfg.option_name}) allows only a single selection.` };
    }
  }

  const digits = Array.from(grouped.keys()).sort((a, b) => a - b);
  if (!digits.length) return { rows: [] };

  let combinations: Array<{ byOption: Record<string, string>; byDigitCode: Record<number, string>; refs: Record<string, number> }> = [{ byOption: {}, byDigitCode: {}, refs: {} }];

  for (const digit of digits) {
    const choices = grouped.get(digit) || [];
    if (!choices.length) continue;
    const next: typeof combinations = [];
    for (const base of combinations) {
      for (const choice of choices) {
        next.push({
          byOption: { ...base.byOption, [choice.optionName]: choice.choiceValue },
          byDigitCode: { ...base.byDigitCode, [digit]: choice.codeValue },
          refs: choice.cpqImportRowId ? { ...base.refs, [choice.optionName]: choice.cpqImportRowId } : { ...base.refs }
        });
      }
    }
    combinations = next;
  }

  const activeRules = dependencyRules.filter((rule) => rule.active && rule.rule_type === 'match_code');
  const constrained = combinations.filter((combo) => {
    for (const rule of activeRules) {
      const source = combo.byDigitCode[rule.source_digit_position];
      const target = combo.byDigitCode[rule.target_digit_position];
      if (source && target && source !== target) return false;
    }
    return true;
  });

  const rows = constrained.map((combo) => {
    const row: Record<string, any> = Object.fromEntries(CPQ_COLUMNS.map((column) => [column, '']));
    const chars = Array(30).fill('_');
    for (const [digit, codeValue] of Object.entries(combo.byDigitCode)) {
      const idx = Number(digit) - 1;
      if (idx >= 0 && idx < chars.length) chars[idx] = String(codeValue).toUpperCase();
    }

    chars[16] = normalizeCharacter17('A');
    const skuCode = chars.join('').replace(/_+$/g, '') || '_';

    row.CPQRuleset = cpqRuleset;
    row.ProductAssist = productAssist;
    row.ProductFamily = productFamily;
    row.ProductLine = productLine;
    row.ProductType = productType;
    row.ProductModel = productModel;
    row['SKU code'] = skuCode;
    row.Description = `${productLine} ${productModel}`;
    row.ConfigCode = skuCode;
    row.OptionBox = productType.toLowerCase() === 'special edition' ? 'Special' : 'Standard';

    for (const [optionName, choiceValue] of Object.entries(combo.byOption)) {
      if (CPQ_COLUMNS.includes(optionName)) row[optionName] = choiceValue;
    }

    row.__refs = {
      CPQRuleset: null,
      ProductAssist: null,
      ProductFamily: null,
      ProductLine: null,
      ProductType: null,
      ProductModel: null,
      ...combo.refs
    };

    return row;
  });

  return { rows };
}

export async function POST(request: Request) {
  const auth = await requireApiRole('builder.use');
  if (auth instanceof NextResponse) return auth;

  try {
    const [body, digitConfigRows, dependencyRuleRows] = await Promise.all([
      request.json(),
      sql`select digit_position, option_name, is_required, selection_mode from sku_digit_option_config where is_active = true order by digit_position`,
      sql`select source_digit_position, target_digit_position, rule_type, active, sort_order from sku_generation_dependency_rules where active = true order by sort_order`
    ]);
    const digitConfigs = (digitConfigRows as any[]).map((row) => ({
      digit_position: Number(row.digit_position),
      option_name: String(row.option_name),
      is_required: Boolean(row.is_required),
      selection_mode: String(row.selection_mode) === 'multi' ? 'multi' : 'single'
    })) as DigitConfig[];
    const dependencyRules = (dependencyRuleRows as any[]).map((row) => ({
      source_digit_position: Number(row.source_digit_position),
      target_digit_position: Number(row.target_digit_position),
      rule_type: 'match_code' as const,
      active: Boolean(row.active),
      sort_order: Number(row.sort_order || 0)
    })) as DependencyRule[];
    const result = buildRowsFromSelectedChoices(body, digitConfigs, dependencyRules);
    if (result.error) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, rows: result.rows || [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unexpected generation error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  let runId = 0;
  try {
    const auth = await requireApiRole('builder.use');
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    runId = Number(searchParams.get('run_id') || 0);
    if (!runId) return NextResponse.json({ success: false, phase: 'generation_validation', error: 'run_id is required' }, { status: 400 });

    await trackLegacyPathInvocation({ pathKey: 'cpq.import_runs.generate_get', route: '/api/cpq/generate', method: 'GET', userId: auth.user.id, details: { runId } });

    const runRows = await sql`select * from cpq_import_runs where id = ${runId} limit 1` as any[];
    if (!runRows.length) return NextResponse.json({ success: false, phase: 'generation_validation', error: 'Import run not found' }, { status: 404 });
    const run = runRows[0];

    await sql`update cpq_import_runs set current_phase = 'generating_combinations', error_message = null, error_stack = null where id = ${runId}`;

    const importRows = await sql`
      select row_number, digit_position, option_name, code_value, status, action_attempted
      from cpq_import_rows
      where import_run_id = ${runId}
        and (
          status = 'imported'
          or (status = 'skipped' and action_attempted = 'skip_duplicate')
        )
      order by row_number
    ` as Array<{ row_number: number; digit_position: number; option_name: string; code_value: string; status: string; action_attempted: string | null }>;

    if (!importRows.length) {
      return NextResponse.json({ success: false, phase: 'generation_validation', error: 'No valid normalized rows were available for generation' }, { status: 400 });
    }

    const scopedKeySet = new Set(importRows.map((row) => `${Number(row.digit_position)}|${String(row.code_value || (Number(row.digit_position) === 0 ? '-' : '')).toUpperCase()}|${String(mapOptionNameToCanonical(row.option_name) || row.option_name).toLowerCase()}`));
    const canonicalRows = await sql`
      select id, digit_position, option_name, code_value, choice_value,
             null::text as description_element,
             coalesce(is_active, true) as is_active,
             deactivated_at,
             deactivation_reason
      from cpq_import_rows
      where status = 'imported'
        and coalesce(is_active, true) = true
      order by id desc
    ` as any[];

    const scopedRulesByKey = new Map<string, any>();
    for (const row of canonicalRows) {
      const canonicalOption = mapOptionNameToCanonical(row.option_name) || row.option_name;
      const scopedKey = `${Number(row.digit_position)}|${String(row.code_value || '').toUpperCase()}|${String(canonicalOption).toLowerCase()}`;
      if (!scopedKeySet.has(scopedKey)) continue;
      if (!scopedRulesByKey.has(scopedKey)) scopedRulesByKey.set(scopedKey, { ...row, option_name: canonicalOption });
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
    if (runId) {
      await sql`
        update cpq_import_runs
        set current_phase = 'generation_failed',
            status = 'failed',
            error_message = ${message},
            error_stack = ${error instanceof Error ? error.stack : null},
            failed_at = now()
        where id = ${runId}
      `;
    }
    return NextResponse.json({ success: false, phase: 'generation_failed', error: message }, { status: 500 });
  }
}
