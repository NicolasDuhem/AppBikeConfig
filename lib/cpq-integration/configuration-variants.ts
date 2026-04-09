import { randomUUID } from 'node:crypto';
import type { ConfigurationVariantCard, CpqIntegrationParameter } from '@/lib/cpq-integration/contracts';
import {
  describeCpqStartFailure,
  isMockMode,
  mergeCpqIntegrationParameters,
  parseCpqIntegrationParametersFromEnv
} from '@/lib/cpq-integration/client';
import { cpqStartForRulesetEntry, resolveRulesetEntry, variantKeysForEntry } from '@/lib/cpq-integration/catalogue';
import { highlightsFromNormalizedState, mockNormalizedState, normalizeConfiguratorResponse } from '@/lib/cpq-integration/mappers';

export const DEV_LOCATION_HEADER = 'x-bb-customer-location';

type ResponseBody = {
  ok: boolean;
  mock?: boolean;
  bikeTypeId: string;
  variants: ConfigurationVariantCard[];
  nextCursor: string | null;
  totalVariantKeys: number;
  error?: string;
  errors?: string[];
};

function integrationParamsForRequest(customerLocationOverride?: string): CpqIntegrationParameter[] {
  const base = parseCpqIntegrationParametersFromEnv();
  if (!customerLocationOverride?.trim()) return base;
  const loc = customerLocationOverride.trim();
  const next = base.map((param) => (param.name === 'CustomerLocation' ? { ...param, simpleValue: loc } : { ...param }));
  if (!next.some((param) => param.name === 'CustomerLocation')) {
    next.push({ name: 'CustomerLocation', simpleValue: loc, type: 'string' });
  }
  return next;
}

export async function buildConfigurationVariantsResponse(opts: {
  bikeTypeId: string;
  cursor: number;
  limit: number;
  customerLocationOverride?: string;
}): Promise<ResponseBody> {
  const entry = resolveRulesetEntry(opts.bikeTypeId);
  if (!entry) {
    return { ok: false, bikeTypeId: opts.bikeTypeId, variants: [], nextCursor: null, totalVariantKeys: 0, error: `Unknown bike type id: ${opts.bikeTypeId}` };
  }

  const keys = variantKeysForEntry(entry);
  const slice = keys.slice(opts.cursor, opts.cursor + opts.limit);
  const nextCursor = opts.cursor + slice.length < keys.length ? String(opts.cursor + slice.length) : null;

  if (isMockMode()) {
    const mock = mockNormalizedState();
    const variants = slice.map((key, index) => ({
      id: `${opts.bikeTypeId}:${key || 'base'}:${index}`,
      bikeTypeId: opts.bikeTypeId,
      variantKey: key,
      title: key ? `Mock variant ${key}` : 'Mock baseline',
      subtitle: 'Set CPQ_API_KEY for live variants',
      modelCode: `MOCK-${index}`,
      tradePrice: mock.tradePrice,
      msrp: mock.msrp,
      currencyCode: mock.currencyCode,
      highlights: highlightsFromNormalizedState(mock, 4),
      cpqDetailId: randomUUID().replace(/-/g, ''),
      configureQuery: { ruleset: entry.ruleset, namespace: entry.namespace, headerId: entry.headerId, ...(key ? { variantKey: key } : {}) }
    }));
    return { ok: true, mock: true, bikeTypeId: opts.bikeTypeId, variants, nextCursor, totalVariantKeys: keys.length };
  }

  const integration = mergeCpqIntegrationParameters(integrationParamsForRequest(opts.customerLocationOverride), []);
  const variants: ConfigurationVariantCard[] = [];
  const errors: string[] = [];

  for (const key of slice) {
    const detailId = randomUUID().replace(/-/g, '');
    const { status, data } = await cpqStartForRulesetEntry(entry, integration, key.trim() || undefined, detailId);
    if (status < 200 || status >= 300) {
      errors.push(describeCpqStartFailure(data) ?? `${key || '(baseline)'}: CPQ ${status}`);
      continue;
    }
    const norm = normalizeConfiguratorResponse(data);
    variants.push({
      id: `${opts.bikeTypeId}:${key || 'base'}`,
      bikeTypeId: opts.bikeTypeId,
      variantKey: key,
      title: key ? `${entry.displayTitle ?? entry.ruleset} — ${key}` : norm.productDescription || entry.ruleset,
      subtitle: norm.productDescription || undefined,
      modelCode: norm.productCode || '—',
      tradePrice: norm.tradePrice ?? norm.configuredPrice ?? null,
      msrp: norm.msrp,
      currencyCode: norm.currencyCode,
      highlights: highlightsFromNormalizedState(norm, 4),
      cpqDetailId: detailId,
      configureQuery: { ruleset: entry.ruleset, namespace: entry.namespace, headerId: entry.headerId, ...(key ? { variantKey: key } : {}) }
    });
  }

  return { ok: true, bikeTypeId: opts.bikeTypeId, variants, nextCursor, totalVariantKeys: keys.length, ...(errors.length ? { errors } : {}) };
}
