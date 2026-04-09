import { cookies } from 'next/headers';
import { createBrowserSessionToken } from '@/lib/cpq-integration/session-store';

export const CPQ_SESSION_COOKIE = 'appbike_cpq_session';

export function ensureBrowserSessionToken() {
  const store = cookies();
  const existing = store.get(CPQ_SESSION_COOKIE)?.value;
  if (existing) return existing;
  const token = createBrowserSessionToken();
  store.set(CPQ_SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 4 });
  return token;
}

export function readBrowserSessionToken() {
  return cookies().get(CPQ_SESSION_COOKIE)?.value;
}

export function clearBrowserSessionToken() {
  cookies().set(CPQ_SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
}
