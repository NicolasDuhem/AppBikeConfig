import { randomUUID } from 'node:crypto';

type SessionRecord = { cpqSessionId: string; updatedAt: number };

const store = new Map<string, SessionRecord>();
const TTL_MS = 4 * 60 * 60 * 1000;

export function createBrowserSessionToken() {
  return randomUUID();
}

export function setCpqSession(token: string, cpqSessionId: string) {
  store.set(token, { cpqSessionId, updatedAt: Date.now() });
}

export function getSession(token: string): SessionRecord | null {
  const current = store.get(token);
  if (!current) return null;
  if (Date.now() - current.updatedAt > TTL_MS) {
    store.delete(token);
    return null;
  }
  return current;
}

export function touchSession(token: string) {
  const current = store.get(token);
  if (current) current.updatedAt = Date.now();
}

export function clearSession(token: string) {
  store.delete(token);
}
