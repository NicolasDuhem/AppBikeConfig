import { randomUUID } from "node:crypto";
import {
  describeCpqStartFailure,
  isMockMode,
  logCpqDebug,
  mergeCpqIntegrationParameters,
  parseCpqIntegrationParametersFromEnv,
  type CpqIntegrationParameter,
} from "./client.js";
import {
  cpqStartForRulesetEntry,
  resolveRulesetEntry,
  variantKeysForEntry,
  type RulesetEntry,
} from "./catalogue.js";
import { highlightsFromNormalizedState, mockNormalizedState, normalizeConfiguratorResponse } from "./mappers.js";

export type ConfigurationVariantCard = {
  id: string;
  bikeTypeId: string;
  variantKey: string;
  title: string;
  subtitle?: string;
  modelCode: string;
  tradePrice: number | null;
  msrp: number | null;
  currencyCode?: string;
  highlights: string[];
  cpqDetailId: string;
  configureQuery: {
    ruleset: string;
    namespace: string;
    headerId: string;
    variantKey?: string;
  };
};

export type ConfigurationVariantsApiResponse = {
  ok: boolean;
  mock?: boolean;
  bikeTypeId: string;
  variants: ConfigurationVariantCard[];
  nextCursor: string | null;
  totalVariantKeys: number;
  error?: string;
  errors?: string[];
};

export const DEV_LOCATION_HEADER = "x-bb-customer-location";

export function integrationParamsForRequest(customerLocationOverride?: string): CpqIntegrationParameter[] {
  const base = parseCpqIntegrationParametersFromEnv();
  if (!customerLocationOverride?.trim()) return base;
  const loc = customerLocationOverride.trim();
  const merged = base.map((p) =>
    p.name === "CustomerLocation" ? { ...p, simpleValue: loc } : { ...p },
  );
  if (!merged.some((p) => p.name === "CustomerLocation")) {
    merged.push({ name: "CustomerLocation", simpleValue: loc, type: "string" });
  }
  return merged;
}

function variantCardFromNorm(
  bikeTypeId: string,
  variantKey: string,
  cpqDetailId: string,
  entry: Pick<RulesetEntry, "ruleset" | "namespace" | "headerId" | "displayTitle">,
  norm: ReturnType<typeof normalizeConfiguratorResponse>,
): ConfigurationVariantCard {
  const vk = variantKey.trim();
  const title =
    (vk ? `${entry.displayTitle ?? "Variant"} — ${vk}` : norm.productDescription?.trim()) ||
    entry.displayTitle ||
    entry.ruleset;
  return {
    id: `${bikeTypeId}:${vk || "base"}`,
    bikeTypeId,
    variantKey: vk,
    title,
    subtitle: vk ? norm.productDescription?.trim() || undefined : undefined,
    modelCode: norm.productCode?.trim() || "—",
    tradePrice: norm.tradePrice ?? norm.configuredPrice ?? null,
    msrp: norm.msrp ?? null,
    currencyCode: norm.currencyCode,
    highlights: highlightsFromNormalizedState(norm, 4),
    cpqDetailId,
    configureQuery: {
      ruleset: entry.ruleset,
      namespace: entry.namespace,
      headerId: entry.headerId,
      ...(vk ? { variantKey: vk } : {}),
    },
  };
}

export async function buildConfigurationVariantsResponse(opts: {
  bikeTypeId: string;
  cursor: number;
  limit: number;
  customerLocationOverride?: string;
}): Promise<ConfigurationVariantsApiResponse> {
  const { bikeTypeId, cursor, limit } = opts;
  const integrationParameters = mergeCpqIntegrationParameters(
    integrationParamsForRequest(opts.customerLocationOverride),
    [],
  );

  const entry = resolveRulesetEntry(bikeTypeId);
  if (!entry) {
    return {
      ok: false,
      bikeTypeId,
      variants: [],
      nextCursor: null,
      totalVariantKeys: 0,
      error: `Unknown bike type id: ${bikeTypeId}`,
    };
  }

  const keys = variantKeysForEntry(entry);
  const totalVariantKeys = keys.length;
  const slice = keys.slice(cursor, cursor + limit);
  const nextCursor = cursor + slice.length < totalVariantKeys ? String(cursor + slice.length) : null;

  if (isMockMode()) {
    logCpqDebug("mock: configuration-variants — synthetic pages");
    const norm = mockNormalizedState();
    const variants: ConfigurationVariantCard[] = slice.map((vk, i) => {
      const idSuffix = vk.trim() || "base";
      const cpqDetailId = randomUUID().replace(/-/g, "");
      return {
        id: `${bikeTypeId}:${idSuffix}:${cursor + i}`,
        bikeTypeId,
        variantKey: vk.trim(),
        title: vk.trim() ? `Mock variant (${vk.trim()})` : "Mock baseline configuration",
        subtitle: `Page offset ${cursor + i} — set CPQ_API_KEY for live CPQ`,
        modelCode: `MOCK-${cursor + i}`,
        tradePrice: norm.configuredPrice ?? null,
        msrp: null,
        highlights: highlightsFromNormalizedState(norm, 3),
        cpqDetailId,
        configureQuery: {
          ruleset: entry.ruleset,
          namespace: entry.namespace,
          headerId: entry.headerId,
          ...(vk.trim() ? { variantKey: vk.trim() } : {}),
        },
      };
    });
    return {
      ok: true,
      mock: true,
      bikeTypeId,
      variants,
      nextCursor,
      totalVariantKeys,
    };
  }

  const missing = (
    ["CPQ_INSTANCE_NAME", "CPQ_APPLICATION_NAME", "CPQ_RULESET", "CPQ_NAMESPACE", "CPQ_HEADER_ID"] as const
  ).filter((v) => !process.env[v]?.trim());
  if (missing.length) {
    return {
      ok: false,
      bikeTypeId,
      variants: [],
      nextCursor: null,
      totalVariantKeys,
      error: `Missing required env vars: ${missing.join(", ")}`,
    };
  }

  const variants: ConfigurationVariantCard[] = [];
  const errors: string[] = [];

  for (const vk of slice) {
    const detailId = randomUUID().replace(/-/g, "");
    try {
      const { status, data } = await cpqStartForRulesetEntry(entry, integrationParameters, vk.trim() || undefined, detailId);
      if (status < 200 || status >= 300) {
        const hint = describeCpqStartFailure(data);
        errors.push(hint ?? `variantKey=${vk || "(baseline)"}: CPQ ${status}`);
        continue;
      }
      const norm = normalizeConfiguratorResponse(data);
      variants.push(variantCardFromNorm(bikeTypeId, vk, detailId, entry, norm));
    } catch (e) {
      errors.push(`${vk || "baseline"}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  return {
    ok: true,
    mock: false,
    bikeTypeId,
    variants,
    nextCursor,
    totalVariantKeys,
    ...(errors.length ? { errors } : {}),
  };
}
