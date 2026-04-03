import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireApiLogin, requireApiRole } from '@/lib/api-auth';
import { writeAuditLog } from '@/lib/audit';

function normalizeCodeValue(value: string) {
  return value.trim().toUpperCase();
}

async function validateDigitOptionConsistency(digitPosition: number, optionName: string, ignoreId?: number) {
  const rows = await sql`
    select id, option_name
    from sku_rules
    where digit_position = ${digitPosition}
      and (${ignoreId || 0} = 0 or id <> ${ignoreId || 0})
    limit 1
  ` as any[];
  if (!rows.length) return null;
  if (String(rows[0].option_name).trim().toLowerCase() !== optionName.trim().toLowerCase()) {
    return `Digit ${digitPosition} is already tied to option name '${rows[0].option_name}'`;
  }
  return null;
}

async function getDigitIssues() {
  const rows = await sql`
    select digit_position, array_agg(distinct option_name order by option_name) as option_names
    from sku_rules
    group by digit_position
    having count(distinct lower(option_name)) > 1
    order by digit_position
  ` as any[];
  return rows.map((row) => ({ digit_position: Number(row.digit_position), option_names: row.option_names }));
}

export async function GET(request: Request) {
  const auth = await requireApiLogin();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get('include_inactive') === '1';

  const rows = includeInactive
    ? await sql`select id, digit_position, option_name, code_value, choice_value, description_element, is_active, deactivated_at, deactivation_reason from sku_rules order by digit_position, option_name, choice_value, id`
    : await sql`select id, digit_position, option_name, code_value, choice_value, description_element, is_active, deactivated_at, deactivation_reason from sku_rules where is_active = true order by digit_position, option_name, choice_value, id`;

  const digitIssues = await getDigitIssues();
  return NextResponse.json({ rows, digitIssues });
}

export async function POST(request: Request) {
  const auth = await requireApiRole('sku.manage');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const digitPosition = Number(body.digit_position || 0);
  const optionName = String(body.option_name || '').trim();
  const codeValue = normalizeCodeValue(String(body.code_value || ''));
  const choiceValue = String(body.choice_value || '').trim();
  const descriptionElement = String(body.description_element || '').trim() || null;

  if (!digitPosition || !optionName || !codeValue || !choiceValue) {
    return NextResponse.json({ error: 'digit_position, option_name, code_value and choice_value are required' }, { status: 400 });
  }
  if (!/^[A-Z0-9]$/.test(codeValue)) {
    return NextResponse.json({ error: 'code_value must be exactly one alphanumeric character (A-Z or 0-9)' }, { status: 400 });
  }

  const optionNameError = await validateDigitOptionConsistency(digitPosition, optionName);
  if (optionNameError) return NextResponse.json({ error: optionNameError }, { status: 400 });

  const existingActiveCode = await sql`
    select id
    from sku_rules
    where digit_position = ${digitPosition}
      and upper(code_value) = ${codeValue}
      and is_active = true
    limit 1
  ` as any[];
  if (existingActiveCode.length) {
    return NextResponse.json({ error: `Active duplicate exists for digit ${digitPosition} and code ${codeValue}` }, { status: 409 });
  }

  const rows = await sql`
    insert into sku_rules (digit_position, option_name, code_value, choice_value, description_element, is_active)
    values (${digitPosition}, ${optionName}, ${codeValue}, ${choiceValue}, ${descriptionElement}, true)
    returning id, digit_position, option_name, code_value, choice_value, description_element, is_active, deactivated_at, deactivation_reason
  ` as any[];

  await writeAuditLog({
    userId: auth.user.id,
    actionKey: 'sku.manage',
    entityType: 'sku_rule',
    entityId: String(rows[0].id),
    newData: rows[0]
  });

  return NextResponse.json(rows[0]);
}

export async function PATCH(request: Request) {
  const auth = await requireApiRole('sku.manage');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const id = Number(body.id || 0);
  const isActive = !!body.is_active;
  const reason = String(body.deactivation_reason || '').trim();

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const existing = await sql`select * from sku_rules where id = ${id}` as any[];
  if (!existing.length) return NextResponse.json({ error: 'Row not found' }, { status: 404 });

  const row = existing[0];

  if (!isActive && !reason) {
    return NextResponse.json({ error: 'deactivation_reason is required when deactivating a line' }, { status: 400 });
  }

  if (isActive) {
    const duplicateActive = await sql`
      select id
      from sku_rules
      where id <> ${id}
        and digit_position = ${row.digit_position}
        and upper(code_value) = ${normalizeCodeValue(row.code_value)}
        and is_active = true
      limit 1
    ` as any[];
    if (duplicateActive.length) {
      return NextResponse.json({ error: `Cannot reactivate: active duplicate exists for digit ${row.digit_position} and code ${normalizeCodeValue(row.code_value)}` }, { status: 409 });
    }
  }

  const updated = await sql`
    update sku_rules
    set
      is_active = ${isActive},
      deactivated_at = case when ${isActive} then null else now() end,
      deactivation_reason = case when ${isActive} then null else ${reason} end
    where id = ${id}
    returning id, digit_position, option_name, code_value, choice_value, description_element, is_active, deactivated_at, deactivation_reason
  ` as any[];

  await writeAuditLog({
    userId: auth.user.id,
    actionKey: 'sku.manage',
    entityType: 'sku_rule',
    entityId: String(id),
    oldData: row,
    newData: updated[0]
  });

  return NextResponse.json(updated[0]);
}
