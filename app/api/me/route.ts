import { NextResponse } from 'next/server';
import { requireApiLogin } from '@/lib/api-auth';

export async function GET() {
  const auth = await requireApiLogin();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({
    user: auth.user,
    roles: auth.roles,
    permissions: auth.permissions
  });
}
