import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { sql } from '@/lib/db';
import { CPQ_OPTION_NAMES, isValidCharacter17, normalizeCharacter17, parseSimpleCsv } from '@/lib/cpq';

export async function POST(request: Request) {
  const auth = await requireApiRole('builder.use');
  if (auth instanceof NextResponse) return auth;

  const form = await request.formData();
  const file = form.get('file') as File | null;
  const selectedLine = String(form.get('selectedLine') || '').trim();
  const electricType = String(form.get('electricType') || '').trim();
  const isSpecial = String(form.get('isSpecial') || '').trim() === 'Yes';
  const specialEditionName = String(form.get('specialEditionName') || '').trim();
  const character17 = normalizeCharacter17(String(form.get('character17') || ''));

  if (!file) return NextResponse.json({ error: 'CSV file is required' }, { status: 400 });
  if (!isValidCharacter17(character17)) return NextResponse.json({ error: 'Character 17 must be one uppercase A-Z or 0-9 character' }, { status: 400 });
  if (isSpecial && !specialEditionName) return NextResponse.json({ error: 'Special edition name is required when special is Yes' }, { status: 400 });

  const content = await file.text();
  const parsed = parseSimpleCsv(content);

  const runRows = await sql`
    insert into cpq_import_runs (
      file_name, selected_line, electric_type, is_special, special_edition_name, character_17, uploaded_by, rows_read
    )
    values (${file.name}, ${selectedLine}, ${electricType}, ${isSpecial}, ${isSpecial ? specialEditionName : null}, ${character17}, ${auth.user.id}, ${parsed.length})
    returning id
  ` as any[];
  const runId = Number(runRows[0].id);

  let rowsImported = 0;
  let rowsSkipped = 0;
  let rowsDeactivated = 0;
  let rowsInserted = 0;

  for (const row of parsed) {
    const optionName = row.optionName;
    if (!CPQ_OPTION_NAMES.includes(optionName as any)) {
      rowsSkipped += 1;
      await sql`
        insert into cpq_import_rows (import_run_id, row_number, option_name, choice_value, digit_position, code_value, status, reason)
        values (${runId}, ${row.rowNumber}, ${row.rawOptionName}, ${row.choiceValue}, ${row.digitPosition || null}, ${row.codeValue}, 'skipped', 'Unknown option name skipped')
      `;
      continue;
    }

    const normalizedCodeValue = row.digitPosition === 0 ? (row.codeValue || '-') : row.codeValue;
    const validNonStatic = row.digitPosition > 0 && /^[A-Z0-9]$/.test(normalizedCodeValue) && !!row.choiceValue;
    const validStatic = row.digitPosition === 0 && !!row.choiceValue;
    if (!validNonStatic && !validStatic) {
      rowsSkipped += 1;
      await sql`
        insert into cpq_import_rows (import_run_id, row_number, option_name, choice_value, digit_position, code_value, status, reason)
        values (${runId}, ${row.rowNumber}, ${optionName}, ${row.choiceValue}, ${row.digitPosition || null}, ${row.codeValue}, 'error', 'Invalid digit/code/choice')
      `;
      continue;
    }

    if (row.digitPosition > 0) {
      const digitConflict = await sql`
        select id, option_name
        from sku_rules
        where digit_position = ${row.digitPosition}
        limit 1
      ` as any[];

      if (digitConflict.length && String(digitConflict[0].option_name).toLowerCase() !== optionName.toLowerCase()) {
        rowsSkipped += 1;
        await sql`
          insert into cpq_import_rows (import_run_id, row_number, option_name, choice_value, digit_position, code_value, status, reason)
          values (${runId}, ${row.rowNumber}, ${optionName}, ${row.choiceValue}, ${row.digitPosition}, ${row.codeValue}, 'error', ${`Digit ${row.digitPosition} is tied to option ${digitConflict[0].option_name}`})
        `;
        continue;
      }
    }

    const existingActive = await sql`
      select id
      from sku_rules
      where digit_position = ${row.digitPosition}
        and lower(option_name) = lower(${optionName})
        and upper(code_value) = upper(${normalizedCodeValue})
        and is_active = true
      limit 1
    ` as any[];

    if (existingActive.length) {
      rowsSkipped += 1;
      await sql`
        insert into cpq_import_rows (import_run_id, row_number, option_name, choice_value, digit_position, code_value, status, reason)
        values (${runId}, ${row.rowNumber}, ${optionName}, ${row.choiceValue}, ${row.digitPosition}, ${normalizedCodeValue}, 'skipped', 'Duplicate digit/value skipped')
      `;
      continue;
    }

    await sql`
      insert into sku_rules (digit_position, option_name, code_value, choice_value, description_element, is_active)
      values (${row.digitPosition}, ${optionName}, ${normalizedCodeValue.toUpperCase()}, ${row.choiceValue}, ${row.choiceValue}, true)
    `;

    rowsImported += 1;
    rowsInserted += 1;
    await sql`
      insert into cpq_import_rows (import_run_id, row_number, option_name, choice_value, digit_position, code_value, status)
      values (${runId}, ${row.rowNumber}, ${optionName}, ${row.choiceValue}, ${row.digitPosition}, ${normalizedCodeValue}, 'imported')
    `;
  }

  await sql`
    update cpq_import_runs
    set rows_imported = ${rowsImported}, rows_skipped = ${rowsSkipped}, rows_deactivated = ${rowsDeactivated}, rows_inserted = ${rowsInserted}
    where id = ${runId}
  `;

  return NextResponse.json({
    ok: true,
    runId,
    summary: { rowsRead: parsed.length, rowsImported, rowsSkipped, rowsDeactivated, rowsInserted }
  });
}
