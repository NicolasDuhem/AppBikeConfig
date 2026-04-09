import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { buildConfigurationVariantsResponse, DEV_LOCATION_HEADER } from '@/lib/cpq-integration/configuration-variants';

export async function GET(request: Request) {
  const auth = await requireApiRole('builder.use');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const bikeTypeId = String(searchParams.get('bikeTypeId') || '').trim();
  const cursor = Number(searchParams.get('cursor') || '0');
  const limit = Number(searchParams.get('limit') || '8');
  if (!bikeTypeId) return NextResponse.json({ ok: false, error: 'bikeTypeId is required' }, { status: 400 });
  if (!Number.isInteger(cursor) || cursor < 0) return NextResponse.json({ ok: false, error: 'cursor must be >= 0' }, { status: 400 });
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) return NextResponse.json({ ok: false, error: 'limit must be 1..20' }, { status: 400 });

  const location = request.headers.get(DEV_LOCATION_HEADER) ?? undefined;

  try {
    const result = await buildConfigurationVariantsResponse({ bikeTypeId, cursor, limit, customerLocationOverride: location });
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: 'configuration-variants failed' }, { status: 500 });
  }
}
