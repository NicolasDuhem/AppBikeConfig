import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { buildCatalogueResponse } from '@/lib/cpq-integration/catalogue';
import { isCatalogueCategory } from '@/lib/cpq-integration/contracts';

export async function GET(request: Request) {
  const auth = await requireApiRole('builder.use');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const categoryRaw = (searchParams.get('category') || 'all-bikes').trim();
  if (!isCatalogueCategory(categoryRaw)) {
    return NextResponse.json({ ok: false, error: 'Invalid category' }, { status: 400 });
  }

  try {
    const result = await buildCatalogueResponse(categoryRaw);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: 'catalogue failed' }, { status: 500 });
  }
}
