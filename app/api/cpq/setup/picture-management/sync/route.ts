import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { syncImageManagementFromSampler } from '@/lib/cpq-setup';

export async function POST() {
  const auth = await requireApiRole('setup.manage');
  if (auth instanceof NextResponse) return auth;

  try {
    const summary = await syncImageManagementFromSampler();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    const detail = error instanceof Error ? error.stack ?? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to sync from sampler results',
        details: detail,
      },
      { status: 500 },
    );
  }
}
