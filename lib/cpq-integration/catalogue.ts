import { randomUUID } from 'node:crypto';
import type { BikeSkuCard, CatalogueCategory, CpqIntegrationParameter } from '@/lib/cpq-integration/contracts';
import {
  buildStartPayload,
  cpqStartConfiguration,
  describeCpqStartFailure,
  isMockMode,
  mergeCpqIntegrationParameters,
  parseCpqIntegrationParametersFromEnv
} from '@/lib/cpq-integration/client';
import { highlightsFromNormalizedState, mockNormalizedState, normalizeConfiguratorResponse } from '@/lib/cpq-integration/mappers';

type ProductLine = 'c' | 'p' | 'g' | 't' | 'special';

type RulesetEntry = {
  id: string;
  ruleset: string;
  namespace: string;
  headerId: string;
  line: ProductLine;
  isElectric: boolean;
  displayTitle?: string;
  variantKeys?: string[];
};

const FAMILY_LABEL: Record<ProductLine, string> = {
  c: 'C Line',
  p: 'P Line',
  g: 'G Line',
  t: 'T Line',
  special: 'Special editions'
};

export type CatalogueApiResponse = {
  ok: boolean;
  mock?: boolean;
  category: CatalogueCategory;
  cards: BikeSkuCard[];
  errors?: string[];
  error?: string;
};

function parseRulesets(): RulesetEntry[] {
  const raw = process.env.CPQ_RULESETS_JSON?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object' && typeof item.ruleset === 'string')
      .map((item) => ({
        id: String(item.id ?? item.ruleset).trim(),
        ruleset: String(item.ruleset).trim(),
        namespace: String(item.namespace ?? process.env.CPQ_NAMESPACE ?? '').trim(),
        headerId: String(item.headerId ?? process.env.CPQ_HEADER_ID ?? '').trim(),
        line: (['c', 'p', 'g', 't', 'special'].includes(String(item.line ?? 'c').toLowerCase()) ? String(item.line ?? 'c').toLowerCase() : 'c') as ProductLine,
        isElectric: Boolean(item.isElectric),
        displayTitle: String(item.displayTitle ?? '').trim() || undefined,
        variantKeys: Array.isArray(item.variantKeys) ? item.variantKeys.filter((entry: unknown): entry is string => typeof entry === 'string') : undefined
      }));
  } catch {
    return [];
  }
}

function defaultRuleset(): RulesetEntry | null {
  const ruleset = process.env.CPQ_RULESET?.trim();
  const namespace = process.env.CPQ_NAMESPACE?.trim();
  const headerId = process.env.CPQ_HEADER_ID?.trim();
  if (!ruleset || !namespace || !headerId) return null;
  return { id: ruleset, ruleset, namespace, headerId, line: 'c', isElectric: false };
}

function isFanoutEnabled(): boolean {
  const value = process.env.CPQ_CATALOGUE_FANOUT_VARIANT_KEYS?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

function globalVariantKeys(): string[] {
  const raw = process.env.CPQ_GLOBAL_VARIANT_KEYS_JSON?.trim();
  if (!raw) return [''];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [''];
    const keys = parsed.filter((item): item is string => typeof item === 'string');
    return keys.length ? keys : [''];
  } catch {
    return [''];
  }
}

function variantKeys(entry: RulesetEntry): string[] {
  if (!isFanoutEnabled()) return [''];
  if (entry.variantKeys?.length) return entry.variantKeys;
  return globalVariantKeys();
}

function matchesCategory(category: CatalogueCategory, entry: Pick<RulesetEntry, 'line' | 'isElectric'>) {
  if (category === 'all-bikes') return true;
  if (category === 'electric') return entry.isElectric;
  if (category === 'c-line') return entry.line === 'c' && !entry.isElectric;
  if (category === 'p-line') return entry.line === 'p' && !entry.isElectric;
  if (category === 'g-line') return entry.line === 'g' && !entry.isElectric;
  if (category === 't-line') return entry.line === 't' && !entry.isElectric;
  if (category === 'special-editions') return entry.line === 'special' && !entry.isElectric;
  if (category === 'electric-c-line') return entry.line === 'c' && entry.isElectric;
  if (category === 'electric-p-line') return entry.line === 'p' && entry.isElectric;
  if (category === 'electric-g-line') return entry.line === 'g' && entry.isElectric;
  if (category === 'electric-t-line') return entry.line === 't' && entry.isElectric;
  return false;
}

function missingLiveEnvVars() {
  return ['CPQ_INSTANCE_NAME', 'CPQ_APPLICATION_NAME'].filter((name) => !process.env[name]?.trim());
}

function buildCard(entry: RulesetEntry, norm: ReturnType<typeof normalizeConfiguratorResponse>, variantKey?: string): BikeSkuCard {
  return {
    id: variantKey ? `${entry.id}:${variantKey}` : entry.id,
    bikeTypeId: entry.id,
    title: variantKey
      ? `${(entry.displayTitle ?? norm.productDescription ?? entry.ruleset)} — ${variantKey}`
      : (entry.displayTitle ?? norm.productDescription ?? entry.ruleset),
    subtitle: norm.productDescription || undefined,
    modelCode: norm.productCode || '—',
    familyLabel: FAMILY_LABEL[entry.line],
    isElectric: entry.isElectric,
    tradePrice: norm.tradePrice ?? norm.configuredPrice ?? null,
    msrp: norm.msrp,
    currencyCode: norm.currencyCode,
    highlights: highlightsFromNormalizedState(norm, 5),
    configureQuery: {
      ruleset: entry.ruleset,
      namespace: entry.namespace,
      headerId: entry.headerId,
      ...(variantKey ? { variantKey } : {})
    }
  };
}

export function resolveRulesetEntry(bikeTypeId: string): RulesetEntry | null {
  const id = bikeTypeId.trim();
  if (!id) return null;
  const rulesets = parseRulesets();
  if (rulesets.length) {
    return rulesets.find((entry) => entry.id === id || entry.ruleset === id) ?? null;
  }
  const single = defaultRuleset();
  if (!single) return null;
  return single.id === id || single.ruleset === id ? single : null;
}

export function variantKeysForEntry(entry: RulesetEntry): string[] {
  if (entry.variantKeys?.length) return entry.variantKeys;
  return globalVariantKeys();
}

export async function cpqStartForRulesetEntry(entry: RulesetEntry, integrationParameters: CpqIntegrationParameter[], variantKey?: string, detailId?: string) {
  const payload = buildStartPayload({
    instance: process.env.CPQ_INSTANCE_NAME || '',
    application: process.env.CPQ_APPLICATION_NAME || '',
    profile: process.env.CPQ_PROFILE || 'Default',
    namespace: entry.namespace,
    ruleset: entry.ruleset,
    headerId: entry.headerId,
    detailId: detailId?.trim() || randomUUID().replace(/-/g, ''),
    variantKey: variantKey?.trim() || undefined,
    integrationParameters
  });
  return cpqStartConfiguration(payload);
}

export async function buildCatalogueResponse(category: CatalogueCategory): Promise<CatalogueApiResponse> {
  if (isMockMode()) {
    const norm = mockNormalizedState();
    return {
      ok: true,
      mock: true,
      category,
      cards: [{
        id: 'mock-bike', bikeTypeId: 'mock-bike', title: 'Mock bike', subtitle: 'Set CPQ_API_KEY for live data',
        modelCode: 'MOCK-001', familyLabel: 'C Line', isElectric: true,
        tradePrice: norm.tradePrice, msrp: norm.msrp, currencyCode: norm.currencyCode,
        highlights: highlightsFromNormalizedState(norm, 5),
        configureQuery: { ruleset: 'mock', namespace: 'mock', headerId: 'mock' }
      }]
    };
  }

  const missing = missingLiveEnvVars();
  if (missing.length) return { ok: false, category, cards: [], error: `Missing required env vars: ${missing.join(', ')}` };

  const rulesets = parseRulesets();
  const selected = rulesets.length ? rulesets.filter((entry) => matchesCategory(category, entry)) : [defaultRuleset()].filter(Boolean) as RulesetEntry[];
  const cards: BikeSkuCard[] = [];
  const errors: string[] = [];
  const integration = mergeCpqIntegrationParameters(parseCpqIntegrationParametersFromEnv(), []);

  for (const entry of selected) {
    for (const key of variantKeys(entry)) {
      const variantKey = key.trim() || undefined;
      const { status, data } = await cpqStartForRulesetEntry(entry, integration, variantKey);
      if (status < 200 || status >= 300) {
        errors.push(describeCpqStartFailure(data) ?? `${entry.ruleset}${variantKey ? ` (${variantKey})` : ''}: CPQ ${status}`);
        continue;
      }
      cards.push(buildCard(entry, normalizeConfiguratorResponse(data), variantKey));
    }
  }

  if (!cards.length && errors.length) {
    return { ok: false, category, cards: [], error: errors[0], errors };
  }

  return { ok: true, category, cards, ...(errors.length ? { errors } : {}) };
}
