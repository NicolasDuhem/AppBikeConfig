import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { sql } from '@/lib/db';
import { buildCpqCombinationsDetailed, CPQ_COLUMNS, mapOptionNameToCanonical, normalizeCharacter17 } from '@/lib/cpq-core';
import type { SkuRule } from '@/lib/types';

type SelectedDigitChoice = {
  digitPosition: number;
  optionName: string;
  codeValue: string;
  choiceValue: string;
  cpqImportRowId: number | null;
};

function buildRowsFromSelectedChoices(payload: any) {
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

  const rows = combinations.map((combo) => {
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
    row.Description = productType.toLowerCase() === 'special edition' ? `${productLine} ${productModel}` : `${productLine} ${productModel}`;
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
    const body = await request.json();
    const result = buildRowsFromSelectedChoices(body);
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
    const activeRules = await sql`
      select id, digit_position, option_name, code_value, choice_value, description_element, is_active, deactivated_at, deactivation_reason
      from sku_rules
      where is_active = true
      order by id desc
    ` as SkuRule[];

    const scopedRulesByKey = new Map<string, SkuRule>();
    for (const rule of activeRules) {
      const canonicalOption = mapOptionNameToCanonical(rule.option_name) || rule.option_name;
      const scopedKey = `${Number(rule.digit_position)}|${String(rule.code_value || '').toUpperCase()}|${String(canonicalOption).toLowerCase()}`;
      if (!scopedKeySet.has(scopedKey)) continue;
      if (!scopedRulesByKey.has(scopedKey)) scopedRulesByKey.set(scopedKey, { ...rule, option_name: canonicalOption });
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
