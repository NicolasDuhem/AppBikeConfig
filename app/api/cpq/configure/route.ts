import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { cpqConfigure, isMockMode } from '@/lib/cpq-integration/client';
import { applyMockSelections, mockNormalizedState, normalizeConfiguratorResponse, variantsFromNormalizedState } from '@/lib/cpq-integration/mappers';
import { ensureBrowserSessionToken } from '@/lib/cpq-integration/http-session';
import { getSession, touchSession } from '@/lib/cpq-integration/session-store';
import type { ConfigureBody } from '@/lib/cpq-integration/contracts';

function parseBody(raw: unknown): ConfigureBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as ConfigureBody;
  if (!Array.isArray(body.selections) || body.selections.length === 0) return null;
  if (!body.selections.every((item) => item && typeof item.id === 'string' && typeof item.value === 'string')) return null;
  return body;
}

export async function POST(request: Request) {
  const auth = await requireApiRole('builder.use');
  if (auth instanceof NextResponse) return auth;

  const browserToken = ensureBrowserSessionToken();
  const session = getSession(browserToken);
  if (!session) return NextResponse.json({ ok: false, error: 'No session; call /api/cpq/start first' }, { status: 400 });

  const body = parseBody(await request.json().catch(() => null));
  if (!body) return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });

  if (isMockMode()) {
    const next = applyMockSelections(mockNormalizedState(), body.selections);
    touchSession(browserToken);
    return NextResponse.json({ ok: true, mock: true, clientRequestId: body.clientRequestId, state: next, variants: variantsFromNormalizedState(next) });
  }

  try {
    const { status, data } = await cpqConfigure({
      sessionID: session.cpqSessionId,
      selections: body.selections.map((selection) => ({ id: selection.id, value: selection.value }))
    });

    if (status < 200 || status >= 300) {
      return NextResponse.json({ ok: false, error: 'CPQ configure failed', cpqStatus: status, cpqBody: data }, { status: 502 });
    }

    const state = normalizeConfiguratorResponse(data);
    touchSession(browserToken);
    return NextResponse.json({ ok: true, clientRequestId: body.clientRequestId, state, variants: variantsFromNormalizedState(state) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: 'configure failed' }, { status: 500 });
  }
}
