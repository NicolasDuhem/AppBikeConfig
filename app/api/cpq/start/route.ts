import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import type { StartBody } from '@/lib/cpq-integration/contracts';
import {
  buildStartPayload,
  cpqStartConfiguration,
  describeCpqStartFailure,
  isMockMode,
  mergeCpqIntegrationParameters,
  parseCpqIntegrationParametersFromEnv
} from '@/lib/cpq-integration/client';
import { mockNormalizedState, normalizeConfiguratorResponse, variantsFromNormalizedState } from '@/lib/cpq-integration/mappers';
import { ensureBrowserSessionToken } from '@/lib/cpq-integration/http-session';
import { setCpqSession } from '@/lib/cpq-integration/session-store';

function parseBody(raw: unknown): StartBody {
  if (!raw || typeof raw !== 'object') return {};
  return raw as StartBody;
}

export async function POST(request: Request) {
  const auth = await requireApiRole('builder.use');
  if (auth instanceof NextResponse) return auth;

  const body = parseBody(await request.json().catch(() => ({})));
  const browserToken = ensureBrowserSessionToken();

  if (isMockMode()) {
    const state = mockNormalizedState();
    setCpqSession(browserToken, state.sessionId);
    return NextResponse.json({ ok: true, mock: true, state, variants: variantsFromNormalizedState(state) });
  }

  const ruleset = body.partName?.trim() || process.env.CPQ_RULESET || '';
  const namespace = body.partNamespace?.trim() || process.env.CPQ_NAMESPACE || '';
  const headerId = body.headerId?.trim() || process.env.CPQ_HEADER_ID || '';
  const detailId = body.detailId?.trim() || randomUUID().replace(/-/g, '');

  if (!ruleset) return NextResponse.json({ ok: false, error: 'Missing CPQ ruleset' }, { status: 400 });
  if (!namespace) return NextResponse.json({ ok: false, error: 'Missing CPQ namespace' }, { status: 400 });
  if (!process.env.CPQ_INSTANCE_NAME?.trim()) return NextResponse.json({ ok: false, error: 'Missing CPQ_INSTANCE_NAME' }, { status: 500 });
  if (!process.env.CPQ_APPLICATION_NAME?.trim()) return NextResponse.json({ ok: false, error: 'Missing CPQ_APPLICATION_NAME' }, { status: 500 });

  const integrationParameters = mergeCpqIntegrationParameters(parseCpqIntegrationParametersFromEnv(), body.integrationParameters);
  const payload = buildStartPayload({
    instance: process.env.CPQ_INSTANCE_NAME,
    application: process.env.CPQ_APPLICATION_NAME,
    profile: process.env.CPQ_PROFILE || 'Default',
    namespace,
    ruleset,
    headerId,
    detailId,
    sourceHeaderId: body.sourceHeaderId,
    sourceDetailId: body.sourceDetailId,
    variantKey: body.variantKey,
    integrationParameters
  });

  try {
    const { status, data } = await cpqStartConfiguration(payload);
    if (status < 200 || status >= 300) {
      return NextResponse.json({ ok: false, error: 'CPQ StartConfiguration failed', cpqStatus: status, cpqBody: data, cpqHint: describeCpqStartFailure(data) }, { status: 502 });
    }

    const state = normalizeConfiguratorResponse(data);
    if (!state.sessionId) return NextResponse.json({ ok: false, error: 'Missing sessionID in CPQ response', cpqBody: data }, { status: 502 });
    setCpqSession(browserToken, state.sessionId);

    return NextResponse.json({ ok: true, state, variants: variantsFromNormalizedState(state) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: 'start failed' }, { status: 500 });
  }
}
