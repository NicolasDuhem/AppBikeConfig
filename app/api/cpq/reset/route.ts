import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { clearBrowserSessionToken, readBrowserSessionToken } from '@/lib/cpq-integration/http-session';
import { clearSession } from '@/lib/cpq-integration/session-store';

export async function POST() {
  const auth = await requireApiRole('builder.use');
  if (auth instanceof NextResponse) return auth;

  const browserToken = readBrowserSessionToken();
  if (browserToken) clearSession(browserToken);
  clearBrowserSessionToken();

  return NextResponse.json({ ok: true });
}
