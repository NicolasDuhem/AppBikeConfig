import { randomUUID } from "node:crypto";

export type SessionRecord = {
  cpqSessionId: string;
  updatedAt: number;
};

const store = new Map<string, SessionRecord>();

const TTL_MS = 1000 * 60 * 60 * 4; // 4h POC

export function createBrowserSession(): string {
  return randomUUID();
}

export function getSession(browserToken: string): SessionRecord | undefined {
  const rec = store.get(browserToken);
  if (!rec) return undefined;
  if (Date.now() - rec.updatedAt > TTL_MS) {
    store.delete(browserToken);
    return undefined;
  }
  return rec;
}

export function setCpqSession(browserToken: string, cpqSessionId: string): void {
  store.set(browserToken, { cpqSessionId, updatedAt: Date.now() });
}

export function touchSession(browserToken: string): void {
  const rec = store.get(browserToken);
  if (rec) {
    rec.updatedAt = Date.now();
  }
}

export function clearSession(browserToken: string): void {
  store.delete(browserToken);
}
