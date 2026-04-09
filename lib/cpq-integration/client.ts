import type { CpqIntegrationParameter } from '@/lib/cpq-integration/contracts';

function env(name: string, fallback = ''): string {
  return process.env[name]?.trim() ?? fallback;
}

export function isCpqHttpDebugEnabled(): boolean {
  const value = env('CPQ_DEBUG_HTTP').toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export function isMockMode(): boolean {
  const explicit = env('CPQ_MOCK').toLowerCase();
  if (explicit === '1' || explicit === 'true') return true;
  if (explicit === '0' || explicit === 'false') return false;
  return !env('CPQ_API_KEY');
}

function safeLog(message: string, payload?: unknown) {
  if (!isCpqHttpDebugEnabled()) return;
  if (payload === undefined) {
    console.log(`[CPQ→Infor] ${message}`);
    return;
  }
  console.log(`[CPQ→Infor] ${message}`, payload);
}

export function parseCpqIntegrationParametersFromEnv(): CpqIntegrationParameter[] {
  const raw = env('CPQ_INTEGRATION_PARAMETERS_JSON');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object' && typeof item.name === 'string')
      .map((item) => ({
        name: String(item.name),
        simpleValue: typeof item.simpleValue === 'string' ? item.simpleValue : undefined,
        isNull: typeof item.isNull === 'boolean' ? item.isNull : undefined,
        type: typeof item.type === 'string' ? item.type : undefined
      }));
  } catch {
    safeLog('Invalid CPQ_INTEGRATION_PARAMETERS_JSON; ignoring');
    return [];
  }
}

export function mergeCpqIntegrationParameters(
  fromEnv: CpqIntegrationParameter[],
  fromRequest: CpqIntegrationParameter[] | undefined
): CpqIntegrationParameter[] {
  const merged = new Map<string, CpqIntegrationParameter>();
  for (const item of fromEnv) merged.set(item.name, { ...item });
  for (const item of fromRequest ?? []) merged.set(item.name, { ...item });
  return [...merged.values()];
}

export function buildStartPayload(opts: {
  instance: string;
  application: string;
  profile: string;
  namespace: string;
  ruleset: string;
  headerId: string;
  detailId: string;
  sourceHeaderId?: string;
  sourceDetailId?: string;
  variantKey?: string;
  integrationParameters?: CpqIntegrationParameter[];
}) {
  const cultureName = env('CPQ_CULTURE_NAME');
  return {
    inputParameters: {
      mode: 0,
      profile: opts.profile,
      variantKey: opts.variantKey ?? '',
      ...(cultureName ? { cultureName } : {}),
      application: { instance: opts.instance, name: opts.application },
      part: { namespace: opts.namespace, name: opts.ruleset },
      headerDetail: { headerId: opts.headerId, detailId: opts.detailId },
      sourceHeaderDetail: { headerId: opts.sourceHeaderId ?? '', detailId: opts.sourceDetailId ?? '' },
      integrationParameters: (opts.integrationParameters ?? []).map((item) => ({
        name: item.name,
        simpleValue: item.simpleValue ?? '',
        isNull: item.isNull ?? false,
        type: item.type ?? 'string'
      })),
      rapidOptions: [] as string[]
    }
  };
}

async function post(url: string, body: unknown): Promise<{ status: number; data: any }> {
  const apiKey = env('CPQ_API_KEY');
  const acceptLanguage = env('CPQ_ACCEPT_LANGUAGE', 'en-GB');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Language': acceptLanguage,
      ...(apiKey ? { Authorization: `ApiKey ${apiKey}` } : {})
    },
    body: JSON.stringify(body),
    cache: 'no-store'
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = await response.text();
  }

  safeLog(`${response.status} ${url}`);
  return { status: response.status, data };
}

export function describeCpqStartFailure(data: unknown): string | undefined {
  const typed = data as { ExceptionType?: string; Message?: string } | undefined;
  const kind = typed?.ExceptionType ?? '';
  const message = typed?.Message ?? '';
  if (kind.includes('RulesetNotFoundException')) {
    return 'CPQ ruleset not found for this tenant/profile. Verify CPQ_RULESET(S), CPQ_NAMESPACE and CPQ_INSTANCE/APPLICATION.';
  }
  if (kind.includes('RuleEngineException') && message.includes('FetchFirstValueFromOptionList')) {
    return 'CPQ rule engine reports empty option list. Confirm CPQ integration parameters and CPQ model data.';
  }
  if (kind.includes('RuleEngineException')) {
    return 'CPQ rule engine failed while evaluating start configuration.';
  }
  return undefined;
}

export async function cpqStartConfiguration(body: unknown) {
  return post(
    env('CPQ_START_CONFIGURATION_URL', 'https://configurator.eu1.inforcloudsuite.com/api/v4/ProductConfiguratorUI.svc/json/StartConfiguration'),
    body
  );
}

export async function cpqConfigure(body: unknown) {
  return post(
    env('CPQ_CONFIGURE_URL', 'https://configurator.eu1.inforcloudsuite.com/api/v4/ProductConfiguratorUI.svc/json/configure'),
    body
  );
}

export async function cpqFinalize(sessionID: string) {
  return post(
    env('CPQ_FINALIZE_CONFIGURATION_URL', 'https://configurator.eu1.inforcloudsuite.com/api/v4/ProductConfiguratorUI.svc/json/FinalizeConfiguration'),
    { sessionID }
  );
}
