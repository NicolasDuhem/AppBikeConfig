import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { sql } from '@/lib/db';
import { mapOptionNameToCanonical } from '@/lib/cpq-core';

type RawOptionRow = {
  cpq_import_row_id: number;
  digit_position: number;
  option_name: string;
  code_value: string;
  choice_value: string;
};

function canonicalOptionName(optionName: string) {
  return mapOptionNameToCanonical(optionName) || optionName;
}

export async function GET() {
  const auth = await requireApiRole('builder.use');
  if (auth instanceof NextResponse) return auth;

  const [rawRows, configs, rules] = await Promise.all([
    sql`
      select
        r.id as cpq_import_row_id,
        r.digit_position,
        r.option_name,
        r.code_value,
        r.choice_value
      from cpq_import_rows r
      where r.status = 'imported'
        and coalesce(r.is_active, true) = true
      order by r.digit_position, r.option_name, r.code_value, r.id desc
    `,
    sql`select digit_position, option_name, is_required, selection_mode, is_active from sku_digit_option_config where is_active = true order by digit_position`,
    sql`select source_digit_position, target_digit_position, rule_type, active, sort_order from sku_generation_dependency_rules where active = true order by sort_order, source_digit_position, target_digit_position`
  ]);
  const rows = rawRows as RawOptionRow[];

  const singleValueOptionNames = new Set(['ProductAssist', 'ProductFamily', 'ProductLine', 'ProductType', 'ProductModel']);
  const singleValueOptions = new Map<string, string[]>();
  const configByDigit = new Map<number, { is_required: boolean; selection_mode: 'single' | 'multi'; option_name: string }>();
  for (const config of configs as any[]) {
    configByDigit.set(Number(config.digit_position), {
      is_required: Boolean(config.is_required),
      selection_mode: String(config.selection_mode) === 'multi' ? 'multi' : 'single',
      option_name: String(config.option_name)
    });
  }

  const digitOptionGroups = new Map<number, { digitPosition: number; optionName: string; isRequired: boolean; selectionMode: 'single' | 'multi'; choices: Array<{ cpqImportRowId: number; codeValue: string; choiceValue: string }> }>();

  for (const row of rows) {
    const optionName = canonicalOptionName(String(row.option_name || '').trim());
    const choiceValue = String(row.choice_value || '').trim();
    if (!optionName || !choiceValue) continue;

    if (Number(row.digit_position) === 0 && singleValueOptionNames.has(optionName)) {
      const existing = singleValueOptions.get(optionName) || [];
      if (!existing.includes(choiceValue)) existing.push(choiceValue);
      singleValueOptions.set(optionName, existing.sort((a, b) => a.localeCompare(b)));
      continue;
    }

    if (Number(row.digit_position) <= 0 || Number(row.digit_position) > 30) continue;
    const digitPosition = Number(row.digit_position);
    const codeValue = String(row.code_value || '').toUpperCase();
    const digitConfig = configByDigit.get(digitPosition);

    const existingGroup = digitOptionGroups.get(digitPosition);
    if (existingGroup) {
      if (!existingGroup.choices.some((choice) => choice.codeValue === codeValue)) {
        existingGroup.choices.push({
          cpqImportRowId: Number(row.cpq_import_row_id),
          codeValue,
          choiceValue
        });
      }
      continue;
    }

    digitOptionGroups.set(digitPosition, {
      digitPosition,
      optionName: digitConfig?.option_name || optionName,
      isRequired: digitConfig?.is_required || false,
      selectionMode: digitConfig?.selection_mode || 'multi',
      choices: [{
        cpqImportRowId: Number(row.cpq_import_row_id),
        codeValue,
        choiceValue
      }]
    });
  }

  const digitOptions = Array.from(digitOptionGroups.values())
    .sort((a, b) => a.digitPosition - b.digitPosition)
    .map((group) => ({
      ...group,
      choices: group.choices.sort((a, b) => a.codeValue.localeCompare(b.codeValue))
    }));

  return NextResponse.json({
    productFieldOptions: {
      productAssist: singleValueOptions.get('ProductAssist') || ['Electric', 'Non electric'],
      productFamily: singleValueOptions.get('ProductFamily') || ['Bike', 'P&A'],
      productLine: singleValueOptions.get('ProductLine') || ['A Line', 'C Line', 'P Line', 'T Line', 'G Line'],
      productType: singleValueOptions.get('ProductType') || ['Standard', 'Special edition'],
      productModel: singleValueOptions.get('ProductModel') || []
    },
    digitOptions,
    dependencyRules: rules
  });
}
