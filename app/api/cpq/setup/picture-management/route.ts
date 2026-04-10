import { NextRequest, NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { listImageManagementRows } from '@/lib/cpq-setup';

export async function GET(req: NextRequest) {
  const auth = await requireApiRole('builder.use');
  if (auth instanceof NextResponse) return auth;

  const featureLabel = req.nextUrl.searchParams.get('featureLabel') ?? '';
  const onlyMissingPicture = req.nextUrl.searchParams.get('onlyMissingPicture') === 'true';

  const rows = await listImageManagementRows({
    featureLabel,
    onlyMissingPicture,
  });

  return NextResponse.json({ rows });
}
