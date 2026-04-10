import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { syncImageManagementFromSampler } from '@/lib/cpq-setup';

export async function POST() {
  const auth = await requireApiRole('setup.manage');
  if (auth instanceof NextResponse) return auth;

  const summary = await syncImageManagementFromSampler();
  return NextResponse.json({ summary });
}
