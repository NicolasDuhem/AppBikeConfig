import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { sql } from '@/lib/db';

export async function GET() {
  const auth = await requireApiRole('permissions.manage');
  if (auth instanceof NextResponse) return auth;

  const rows = await sql`
    select id, permission_key, permission_name, description
    from permissions
    order by permission_key
  `;
  return NextResponse.json(rows);
}
