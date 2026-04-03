import { NextResponse } from 'next/server';
import { requireApiLogin } from '@/lib/api-auth';
import { getPermissions } from '@/lib/rbac';

export async function GET() {
  const auth = await requireApiLogin();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({
    user: auth.user,
    roles: auth.roles,
    permissions: getPermissions(auth.roles)
  });
}
