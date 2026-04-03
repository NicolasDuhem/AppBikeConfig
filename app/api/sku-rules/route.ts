import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireApiLogin, requireApiRole } from '@/lib/api-auth';
import { writeAuditLog } from '@/lib/audit';

export async function GET() {
  const auth = await requireApiLogin();
  if (auth instanceof NextResponse) return auth;

  const rows = await sql`select id, digit_position, option_name, code_value, choice_value, description_element from sku_rules order by digit_position, option_name, choice_value`;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const auth = await requireApiRole('sku.manage');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const rows = await sql`
    insert into sku_rules (digit_position, option_name, code_value, choice_value, description_element)
    values (${Number(body.digit_position || 0)}, ${String(body.option_name || '').trim()}, ${String(body.code_value || '').trim()}, ${String(body.choice_value || '').trim()}, ${String(body.description_element || '').trim() || null})
    returning id, digit_position, option_name, code_value, choice_value, description_element
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
