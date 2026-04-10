import { NextRequest, NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { createRuleset, listRulesets } from '@/lib/cpq-setup';

export async function GET(req: NextRequest) {
  const auth = await requireApiRole('builder.use');
  if (auth instanceof NextResponse) return auth;

  const activeOnly = req.nextUrl.searchParams.get('activeOnly') === 'true';
  const rows = await listRulesets(activeOnly);
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiRole('setup.manage');
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    const row = await createRuleset(body);
    return NextResponse.json({ row }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create ruleset' }, { status: 400 });
  }
}
