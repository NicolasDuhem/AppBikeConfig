import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { sql } from '@/lib/db';

export async function GET() {
  const auth = await requireApiRole('users.manage');
  if (auth instanceof NextResponse) return auth;

  const rows = await sql`select id, role_key, role_name from roles order by role_key`;
  return NextResponse.json(rows);
}
