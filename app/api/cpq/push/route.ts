import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { sql } from '@/lib/db';
import { buildCpqAttributeEntries, importRowCacheKey } from '@/lib/cpq-product-attributes';

function pick(row: any, ...keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null) return String(value);
  }
  return '';
}


function pickReferenceRowId(row: any, optionName: string) {
  const refs = row?.__refs;
  if (!refs || typeof refs !== 'object') return null;
  const value = refs[optionName];
  const id = Number(value || 0);
  return id > 0 ? id : null;
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
  const importRowIdCache = new Map<string, number>();
  const skippedDuplicateSkus: string[] = [];
  const failedRows: Array<{ skuCode: string; cpqRuleset: string; reason: string }> = [];
  const seenSkuCodes = new Set<string>();

  for (const row of rows) {
    const skuCode = pick(row, 'SKU code').trim();
    const cpqRuleset = pick(row, 'CPQRuleset').trim();
    if (!skuCode || !cpqRuleset) continue;

    const normalizedSku = skuCode.toLowerCase();
    if (seenSkuCodes.has(normalizedSku)) {
      skippedDuplicateSkus.push(`${skuCode} (${cpqRuleset})`);
      continue;
    }
    seenSkuCodes.add(normalizedSku);

    const existingSku = await sql`
      select id
      from cpq_products
      where lower(sku_code) = lower(${skuCode})
      limit 1
    ` as any[];
    if (existingSku.length) {
      skippedDuplicateSkus.push(`${skuCode} (${cpqRuleset})`);
      continue;
    }

    const cpqProductInsert = await sql`
      insert into cpq_products (
        import_run_id,
        cpq_ruleset,
        sku_code,
        created_by
      )
      values (
        ${runId || null},
        ${cpqRuleset},
        ${skuCode},
        ${auth.user.id}
      )
      returning id
    ` as any[];
    const cpqProductId = Number(cpqProductInsert[0].id);


    const attributeEntries = buildCpqAttributeEntries({
      ...row,
      CPQRuleset: cpqRuleset,
      BrakeReverse: brakeMode === 'reverse' ? 'yes' : 'no',
      BrakeNonReverse: brakeMode === 'non_reverse' ? 'yes' : 'no'
    });

    for (const attribute of attributeEntries) {
      const cacheKey = importRowCacheKey(attribute.optionName, attribute.value);
      let importRowId = importRowIdCache.get(cacheKey);

      if (!importRowId) {
        importRowId = pickReferenceRowId(row, attribute.optionName);
      }

      if (!importRowId) {
        const existingImportRow = await sql`
          select id
          from cpq_import_rows
          where status = 'imported'
            and lower(option_name) = lower(${attribute.optionName})
            and lower(choice_value) = lower(${attribute.value})
          order by id
          limit 1
        ` as any[];

        if (existingImportRow.length) {
          importRowId = Number(existingImportRow[0].id);
        } else {
          const insertedImportRow = await sql`
            insert into cpq_import_rows (
              import_run_id,
              row_number,
              option_name,
              choice_value,
              digit_position,
              code_value,
              status,
              normalized_option_name,
              action_attempted
            )
            values (
              ${runId || null},
              0,
              ${attribute.optionName},
              ${attribute.value},
              null,
              null,
              'imported',
              ${attribute.optionName},
              'reference_attribute'
            )
            on conflict do nothing
            returning id
          ` as any[];

          if (insertedImportRow.length) {
            importRowId = Number(insertedImportRow[0].id);
          } else {
            const fallbackImportRow = await sql`
              select id
              from cpq_import_rows
              where status = 'imported'
                and lower(option_name) = lower(${attribute.optionName})
                and lower(choice_value) = lower(${attribute.value})
              order by id
              limit 1
            ` as any[];
            if (fallbackImportRow.length) importRowId = Number(fallbackImportRow[0].id);
          }
        }
      }

      if (!importRowId) {
        failedRows.push({ skuCode, cpqRuleset, reason: `Failed to resolve CPQ import row for ${attribute.optionName}` });
        continue;
      }

      importRowIdCache.set(cacheKey, importRowId);

      await sql`
        insert into cpq_product_attributes (cpq_product_id, option_name, cpq_import_row_id)
        values (${cpqProductId}, ${attribute.optionName}, ${importRowId})
        on conflict (cpq_product_id, option_name)
        do update set cpq_import_row_id = excluded.cpq_import_row_id, updated_at = now()
      `;
    }

    const existingActive = await sql`
      select id from cpq_sku_rules
      where lower(sku_code) = lower(${skuCode})
        and lower(cpq_ruleset) = lower(${cpqRuleset})
        and brake_type = ${brakeMode}
        and is_active = true
      limit 1
    ` as any[];

    if (existingActive.length) {
      skippedDuplicateSkus.push(`${skuCode} (${cpqRuleset})`);
      await sql`delete from cpq_products where id = ${cpqProductId}`;
      continue;
    }

    const inserted = await sql`
      insert into cpq_sku_rules (cpq_product_id, sku_code, cpq_ruleset, brake_type, bike_type, handlebar, speed, rack, colour, light, seatpost_length, saddle, description, created_by)
      values (
        ${cpqProductId}, ${skuCode}, ${cpqRuleset}, ${brakeMode}, ${pick(row, 'BikeType')}, ${pick(row, 'HandlebarType')}, ${pick(row, 'Speeds')}, ${pick(row, 'MudguardsAndRack', 'MudguardsandRack')},
        ${pick(row, 'MainFrameColour')}, ${pick(row, 'Lighting')}, ${pick(row, 'SaddleHeight')}, ${pick(row, 'Saddle')}, ${pick(row, 'Description')}, ${auth.user.id}
      )
      returning id
    ` as any[];
    const cpqRuleId = Number(inserted[0].id);
    pushed += 1;

    const cpqCountries = await sql`select id from cpq_countries` as any[];
    for (const country of cpqCountries) {
      try {
        await sql`
          insert into cpq_availability (cpq_sku_rule_id, cpq_country_id, available, updated_at)
          values (${cpqRuleId}, ${country.id}, ${false}, now())
          on conflict (cpq_sku_rule_id, cpq_country_id) do nothing
        `;
      } catch (error) {
        failedRows.push({
          skuCode,
          cpqRuleset,
          reason: error instanceof Error ? error.message : 'Failed to create availability row'
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    pushed,
    skippedDuplicateSkuCount: skippedDuplicateSkus.length,
    skippedDuplicateSkus,
    failedRows,
    duplicatePolicy: 'Duplicate SKU codes are skipped during push. No duplicate SKU code is inserted into CPQ products or active CPQ SKU rules.'
  });
}
