import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  const rows = await sql`select id, digit_position, option_name, code_value, choice_value, description_element from sku_rules order by digit_position, option_name, choice_value`;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const rows = await sql`
    insert into sku_rules (digit_position, option_name, code_value, choice_value, description_element)
    values (${Number(body.digit_position || 0)}, ${String(body.option_name || '').trim()}, ${String(body.code_value || '').trim()}, ${String(body.choice_value || '').trim()}, ${String(body.description_element || '').trim() || null})
    returning id, digit_position, option_name, code_value, choice_value, description_element
  `;
  return NextResponse.json(rows[0]);
}
