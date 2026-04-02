import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  const rows = await sql`select id, country, region from countries order by region, country`;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const country = String(body.country || '').trim();
  const region = String(body.region || '').trim();
  if (!country || !region) return NextResponse.json({ error: 'country and region are required' }, { status: 400 });
  const rows = await sql`
    insert into countries (country, region)
    values (${country}, ${region})
    on conflict (country) do update set region = excluded.region
    returning id, country, region
  `;
  return NextResponse.json(rows[0]);
}
