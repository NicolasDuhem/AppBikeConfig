import { NextResponse } from 'next/server';
import { requireLogin, requireRole } from '@/lib/auth';
import type { ActionKey } from '@/lib/rbac';

export async function requireApiLogin() {
  try {
    return await requireLogin();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function requireApiRole(actionKey: ActionKey) {
  try {
    return await requireRole(actionKey);
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}
