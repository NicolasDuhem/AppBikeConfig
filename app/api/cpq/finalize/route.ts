import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { cpqFinalize, isMockMode } from '@/lib/cpq-integration/client';
import { ensureBrowserSessionToken } from '@/lib/cpq-integration/http-session';
import { getSession } from '@/lib/cpq-integration/session-store';

export async function POST() {
  const auth = await requireApiRole('builder.use');
  if (auth instanceof NextResponse) return auth;

  const browserToken = ensureBrowserSessionToken();
  const session = getSession(browserToken);
  if (!session) return NextResponse.json({ ok: false, error: 'No session' }, { status: 400 });

  if (isMockMode()) {
    return NextResponse.json({ ok: true, mock: true, message: 'Finalized (mock)' });
  }

  try {
    const { status, data } = await cpqFinalize(session.cpqSessionId);
    if (status < 200 || status >= 300) {
      return NextResponse.json({ ok: false, error: 'CPQ finalize failed', cpqStatus: status, cpqBody: data }, { status: 502 });
    }
    return NextResponse.json({ ok: true, cpq: data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: 'finalize failed' }, { status: 500 });
  }
}
