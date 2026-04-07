import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { sql } from '@/lib/db';
import { mapCsvOptionNameToCanonical } from '@/lib/cpq';

type RawOptionRow = {
  sku_rule_id: number;
  digit_position: number;
  option_name: string;
  code_value: string;
  choice_value: string;
  cpq_import_row_id: number | null;
};

function canonicalOptionName(optionName: string) {
  return mapCsvOptionNameToCanonical(optionName) || optionName;
}

export async function GET() {
  const auth = await requireApiRole('builder.use');
  if (auth instanceof NextResponse) return auth;

  const rows = await sql`
    select
      r.id as sku_rule_id,
      r.digit_position,
      r.option_name,
      r.code_value,
      r.choice_value,
      ir.id as cpq_import_row_id
    from sku_rules r
    left join cpq_import_rows ir
      on ir.status = 'imported'
     and lower(ir.option_name) = lower(r.option_name)
     and lower(ir.choice_value) = lower(r.choice_value)
    where r.is_active = true
    order by r.digit_position, r.option_name, r.code_value, r.id desc
  ` as RawOptionRow[];

  const singleValueOptionNames = new Set(['ProductAssist', 'ProductFamily', 'ProductLine', 'ProductType', 'ProductModel']);
  const singleValueOptions = new Map<string, string[]>();
  const digitOptionGroups = new Map<number, { digitPosition: number; optionName: string; choices: Array<{ skuRuleId: number; cpqImportRowId: number | null; codeValue: string; choiceValue: string }> }>();

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

    const existingGroup = digitOptionGroups.get(digitPosition);
    if (existingGroup) {
      if (!existingGroup.choices.some((choice) => choice.codeValue === codeValue)) {
        existingGroup.choices.push({
          skuRuleId: Number(row.sku_rule_id),
          cpqImportRowId: row.cpq_import_row_id ? Number(row.cpq_import_row_id) : null,
          codeValue,
          choiceValue
        });
      }
      continue;
    }

    digitOptionGroups.set(digitPosition, {
      digitPosition,
      optionName,
      choices: [{
        skuRuleId: Number(row.sku_rule_id),
        cpqImportRowId: row.cpq_import_row_id ? Number(row.cpq_import_row_id) : null,
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
    digitOptions
  });
}
