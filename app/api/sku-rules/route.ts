import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireApiLogin, requireApiRole } from '@/lib/api-auth';
import { writeAuditLog } from '@/lib/audit';

function normalizeCodeValue(value: string) {
  return value.trim().toUpperCase();
}

async function validateDigitOptionConsistency(digitPosition: number, optionName: string, ignoreId?: number) {
  if (digitPosition === 0) return null;
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
    where digit_position > 0
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
    ? await sql`
      select r.id, r.digit_position, r.option_name, r.code_value, r.choice_value, r.description_element, r.is_active, r.deactivated_at, r.deactivation_reason,
             edit_meta.last_edited_by_email, edit_meta.last_edited_at
      from sku_rules r
      left join lateral (
        select u.email as last_edited_by_email, a.created_at as last_edited_at
        from audit_log a
        left join app_users u on u.id = a.user_id
        where a.entity_type = 'sku_rule'
          and a.entity_id = r.id::text
          and a.action_key = 'sku.manage.edit'
        order by a.created_at desc
        limit 1
      ) edit_meta on true
      order by r.digit_position, r.option_name, r.choice_value, r.id
    `
    : await sql`
      select r.id, r.digit_position, r.option_name, r.code_value, r.choice_value, r.description_element, r.is_active, r.deactivated_at, r.deactivation_reason,
             edit_meta.last_edited_by_email, edit_meta.last_edited_at
      from sku_rules r
      left join lateral (
        select u.email as last_edited_by_email, a.created_at as last_edited_at
        from audit_log a
        left join app_users u on u.id = a.user_id
        where a.entity_type = 'sku_rule'
          and a.entity_id = r.id::text
          and a.action_key = 'sku.manage.edit'
        order by a.created_at desc
        limit 1
      ) edit_meta on true
      where r.is_active = true
      order by r.digit_position, r.option_name, r.choice_value, r.id
    `;

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

  if (!optionName || !codeValue || !choiceValue) {
    return NextResponse.json({ error: 'option_name, code_value and choice_value are required' }, { status: 400 });
  }
  if (digitPosition < 0) {
    return NextResponse.json({ error: 'digit_position must be zero or a positive integer' }, { status: 400 });
  }
  if (digitPosition > 0 && !/^[A-Z0-9]$/.test(codeValue)) {
    return NextResponse.json({ error: 'code_value must be exactly one alphanumeric character (A-Z or 0-9) when digit_position > 0' }, { status: 400 });
  }

  const optionNameError = await validateDigitOptionConsistency(digitPosition, optionName);
  if (optionNameError) return NextResponse.json({ error: optionNameError }, { status: 400 });

  const existingActiveCode = await sql`
    select id
    from sku_rules
    where digit_position = ${digitPosition}
      and lower(option_name) = lower(${optionName})
      and upper(code_value) = ${codeValue}
      and is_active = true
    limit 1
  ` as any[];
  if (existingActiveCode.length) {
    return NextResponse.json({ error: `Active duplicate exists for digit ${digitPosition}, option ${optionName} and code ${codeValue}` }, { status: 409 });
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

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const existing = await sql`select * from sku_rules where id = ${id}` as any[];
  if (!existing.length) return NextResponse.json({ error: 'Row not found' }, { status: 404 });

  const row = existing[0];
  const isEditRequest = Object.prototype.hasOwnProperty.call(body, 'choice_value') || Object.prototype.hasOwnProperty.call(body, 'description_element');

  if (isEditRequest) {
    const choiceValue = String(body.choice_value || '').trim();
    const descriptionElement = String(body.description_element || '').trim() || null;
    if (!choiceValue) return NextResponse.json({ error: 'choice_value is required when editing a row' }, { status: 400 });

    const updated = await sql`
      update sku_rules
      set choice_value = ${choiceValue},
          description_element = ${descriptionElement}
      where id = ${id}
      returning id, digit_position, option_name, code_value, choice_value, description_element, is_active, deactivated_at, deactivation_reason
    ` as any[];

    await writeAuditLog({
      userId: auth.user.id,
      actionKey: 'sku.manage.edit',
      entityType: 'sku_rule',
      entityId: String(id),
      oldData: row,
      newData: { ...updated[0], updated_by_email: auth.user.email, updated_at: new Date().toISOString() }
    });

    return NextResponse.json(updated[0]);
  }

  const isActive = !!body.is_active;
  const reason = String(body.deactivation_reason || '').trim();

  if (!isActive && !reason) {
    return NextResponse.json({ error: 'deactivation_reason is required when deactivating a line' }, { status: 400 });
  }

  if (isActive) {
    const duplicateActive = await sql`
      select id
      from sku_rules
      where id <> ${id}
        and digit_position = ${row.digit_position}
        and lower(option_name) = lower(${row.option_name})
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
