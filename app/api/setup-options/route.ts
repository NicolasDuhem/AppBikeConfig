import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  const rows = await sql`select id, option_name, choice_value, sort_order from setup_options order by option_name, sort_order, choice_value`;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const optionName = String(body.option_name || '').trim();
  const choiceValue = String(body.choice_value || '').trim();
  const sortOrder = Number(body.sort_order || 0);
  if (!optionName || !choiceValue) return NextResponse.json({ error: 'option_name and choice_value are required' }, { status: 400 });
  const rows = await sql`
    insert into setup_options (option_name, choice_value, sort_order)
    values (${optionName}, ${choiceValue}, ${sortOrder})
    returning id, option_name, choice_value, sort_order
  `;
  return NextResponse.json(rows[0]);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('id') || 0);
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  await sql`delete from setup_options where id = ${id}`;
  return NextResponse.json({ ok: true });
}
