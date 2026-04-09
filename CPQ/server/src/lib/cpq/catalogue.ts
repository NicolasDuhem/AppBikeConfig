import { randomUUID } from "node:crypto";
import type { CatalogueCategory } from "./contracts.js";
import {
  buildStartPayload,
  cpqStartConfiguration,
  describeCpqStartFailure,
  isMockMode,
  logCpqDebug,
  mergeCpqIntegrationParameters,
  parseCpqIntegrationParametersFromEnv,
} from "./client.js";
import {
  highlightsFromNormalizedState,
  mockNormalizedState,
  normalizeConfiguratorResponse,
  type FeatureField,
  type NormalizedState,
} from "./mappers.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProductLine = "c" | "p" | "g" | "t" | "special";

export type BikeSkuCard = {
  /** Unique row on the PLP (may be `${bikeTypeId}:${variantKey}` when catalogue fan-out is on). */
  id: string;
  /** CPQ_RULESETS_JSON entry id — use for /variants/:bikeTypeId. */
  bikeTypeId: string;
  title: string;
  subtitle?: string;
  modelCode: string;
  familyLabel: string;
  isElectric: boolean;
  tradePrice: number | null;
  msrp: number | null;
  currencyCode?: string;
  highlights: string[];
  leadTimeLabel?: string;
  stockStatus?: "in-stock" | "low-stock" | "pre-order";
  imageUrl?: string;
  configureQuery: {
    ruleset: string;
    namespace: string;
    headerId: string;
    /** Present when this row came from StartConfiguration with a Design Studio variant key. */
    variantKey?: string;
  };
};

export type CatalogueApiResponse = {
  ok: boolean;
  mock?: boolean;
  category: CatalogueCategory;
  cards: BikeSkuCard[];
  errors?: string[];
  error?: string;
};

const FAMILY_LABEL: Record<ProductLine, string> = {
  c: "C Line",
  p: "P Line",
  g: "G Line",
  t: "T Line",
  special: "Special editions",
};

// ---------------------------------------------------------------------------
// Ruleset configuration — each entry is one product variant on the catalogue
// ---------------------------------------------------------------------------

/**
 * One CPQ ruleset entry. The catalogue shows one card per entry.
 *
 * Read from CPQ_RULESETS_JSON, e.g.:
 *   [
 *     { "id": "c-elec-26", "ruleset": "BBLV6_C-LineElecMY26_Brixton",
 *       "namespace": "BBLV6", "headerId": "Simulator",
 *       "line": "c", "isElectric": true, "displayTitle": "New C line Electric" },
 *     ...
 *   ]
 */
export type RulesetEntry = {
  id: string;
  ruleset: string;
  namespace: string;
  headerId: string;
  line: ProductLine;
  isElectric: boolean;
  displayTitle?: string;
  /** CPQ Design Studio variant keys; empty string = baseline StartConfiguration. */
  variantKeys?: string[];
};

function getRulesetsFromEnv(): RulesetEntry[] {
  const raw = process.env.CPQ_RULESETS_JSON?.trim();
  if (!raw) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    logCpqDebug("CPQ_RULESETS_JSON is not valid JSON — ignoring");
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const entries: RulesetEntry[] = [];
  for (const item of arr) {
    const ruleset = (item as Record<string, unknown>)?.ruleset;
    if (typeof ruleset !== "string" || !ruleset.trim()) continue;
    const rawLine = String((item as Record<string, unknown>)?.line ?? "c").toLowerCase();
    const line: ProductLine = (["c", "p", "g", "t", "special"] as const).includes(rawLine as ProductLine)
      ? (rawLine as ProductLine)
      : "c";
    const vkRaw = (item as Record<string, unknown>)?.variantKeys;
    let variantKeys: string[] | undefined;
    if (Array.isArray(vkRaw)) {
      variantKeys = vkRaw.filter((x): x is string => typeof x === "string");
    }
    entries.push({
      id: String((item as Record<string, unknown>)?.id ?? ruleset).trim(),
      ruleset: ruleset.trim(),
      namespace: String((item as Record<string, unknown>)?.namespace ?? process.env.CPQ_NAMESPACE ?? "").trim(),
      headerId: String((item as Record<string, unknown>)?.headerId ?? process.env.CPQ_HEADER_ID ?? "").trim(),
      line,
      isElectric: Boolean((item as Record<string, unknown>)?.isElectric),
      displayTitle: String((item as Record<string, unknown>)?.displayTitle ?? "").trim() || undefined,
      ...(variantKeys?.length ? { variantKeys } : {}),
    });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Category matching
// ---------------------------------------------------------------------------

function matchesCategory(
  category: CatalogueCategory,
  entry: Pick<RulesetEntry, "line" | "isElectric">,
): boolean {
  switch (category) {
    case "all-bikes":
      // Full configured range (electric + non-electric). Use line/electric-specific routes to narrow.
      return true;
    case "c-line":
      return !entry.isElectric && entry.line === "c";
    case "p-line":
      return !entry.isElectric && entry.line === "p";
    case "g-line":
      return !entry.isElectric && entry.line === "g";
    case "t-line":
      return !entry.isElectric && entry.line === "t";
    case "special-editions":
      return !entry.isElectric && entry.line === "special";
    case "electric":
      return entry.isElectric;
    case "electric-c-line":
      return entry.isElectric && entry.line === "c";
    case "electric-p-line":
      return entry.isElectric && entry.line === "p";
    case "electric-g-line":
      return entry.isElectric && entry.line === "g";
    case "electric-t-line":
      return entry.isElectric && entry.line === "t";
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// CPQ state interpretation
// ---------------------------------------------------------------------------

function lineFromNorm(norm: NormalizedState): ProductLine {
  const lf = norm.features.find((f) => f.label.toLowerCase() === "line" && f.isVisible);
  const name = (lf?.selectedCaption ?? lf?.selectedValue ?? "").toLowerCase();
  if (name.includes("p line") || name.startsWith("p ")) return "p";
  if (name.includes("g line") || name.startsWith("g ")) return "g";
  if (name.includes("t line") || name.startsWith("t ")) return "t";
  return "c";
}

function isElectricFromNorm(norm: NormalizedState): boolean {
  const f = norm.features.find((ff) => ff.label.toLowerCase() === "productassist");
  return f ? f.selectedValue?.toLowerCase().includes("electric") : false;
}

// ---------------------------------------------------------------------------
// Model-defining feature detection (CPQ-driven, not a hardcoded list)
//
// A feature is model-defining when its options carry different non-empty IPN
// position codes OR any option has a non-empty ForecastAs value.  Both signals
// come directly from CPQ custom properties (ipnCode / forecastAs on options).
// ---------------------------------------------------------------------------

export function isModelDefiningFeature(f: FeatureField): boolean {
  if (!f.isVisible || !f.isEnabled) return false;
  if (f.options.length <= 1) return false;

  // Signal 1: any option tagged for demand forecasting
  if (f.options.some((o) => o.forecastAs?.trim())) return true;

  // Signal 2: options contribute distinct, non-empty IPN position codes
  const codes = f.options.map((o) => o.ipnCode?.trim() ?? "").filter((c) => c !== "");
  if (new Set(codes).size >= 2) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Card building
// ---------------------------------------------------------------------------

function isCatalogueFanoutVariantKeysEnabled(): boolean {
  const v = process.env.CPQ_CATALOGUE_FANOUT_VARIANT_KEYS?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** One StartConfiguration per catalogue row unless fan-out is off, then only baseline (`""`). */
function catalogueVariantKeySlices(entry: RulesetEntry): string[] {
  if (isCatalogueFanoutVariantKeysEnabled()) return variantKeysForEntry(entry);
  return [""];
}

function cardFromNorm(
  cardId: string,
  bikeTypeId: string,
  norm: NormalizedState,
  entry: Pick<RulesetEntry, "line" | "isElectric" | "ruleset" | "namespace" | "headerId">,
  title: string,
  variantKey?: string,
): BikeSkuCard {
  const vk = variantKey?.trim();
  return {
    id: cardId,
    bikeTypeId,
    title,
    subtitle: norm.productDescription || undefined,
    modelCode: norm.productCode?.trim() || "—",
    familyLabel: FAMILY_LABEL[entry.line],
    isElectric: entry.isElectric,
    tradePrice: norm.tradePrice ?? norm.configuredPrice ?? null,
    msrp: norm.msrp ?? null,
    currencyCode: norm.currencyCode,
    highlights: highlightsFromNormalizedState(norm, 5),
    imageUrl: undefined,
    configureQuery: {
      ruleset: entry.ruleset,
      namespace: entry.namespace,
      headerId: entry.headerId,
      ...(vk ? { variantKey: vk } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Required env-var guard
// ---------------------------------------------------------------------------

function missingLiveEnvVars(): string[] {
  return (
    ["CPQ_INSTANCE_NAME", "CPQ_APPLICATION_NAME", "CPQ_RULESET", "CPQ_NAMESPACE", "CPQ_HEADER_ID"] as const
  ).filter((v) => !process.env[v]?.trim());
}

// ---------------------------------------------------------------------------
// Build a StartConfiguration payload from the single-ruleset env config
// ---------------------------------------------------------------------------

function singleRulesetFromEnv(): RulesetEntry {
  return {
    id: process.env.CPQ_RULESET!,
    ruleset: process.env.CPQ_RULESET!,
    namespace: process.env.CPQ_NAMESPACE!,
    headerId: process.env.CPQ_HEADER_ID!,
    line: "c",
    isElectric: false,
  };
}

export async function cpqStartForRulesetEntry(
  entry: RulesetEntry,
  integrationParameters: ReturnType<typeof parseCpqIntegrationParametersFromEnv>,
  variantKey?: string,
  detailId?: string,
) {
  const did = detailId?.trim() || randomUUID().replace(/-/g, "");
  const payload = buildStartPayload({
    instance: process.env.CPQ_INSTANCE_NAME!,
    application: process.env.CPQ_APPLICATION_NAME!,
    profile: process.env.CPQ_PROFILE || "Default",
    namespace: entry.namespace,
    ruleset: entry.ruleset,
    headerId: entry.headerId,
    detailId: did,
    variantKey: variantKey?.trim() || undefined,
    integrationParameters,
  });
  return cpqStartConfiguration(payload);
}

export function resolveRulesetEntry(bikeTypeId: string): RulesetEntry | null {
  const id = bikeTypeId.trim();
  if (!id) return null;
  const rulesets = getRulesetsFromEnv();
  if (rulesets.length > 0) {
    const hit = rulesets.find((r) => r.id === id || r.ruleset === id);
    return hit ?? null;
  }
  if (!process.env.CPQ_RULESET?.trim()) return null;
  const single = singleRulesetFromEnv();
  if (single.id === id || single.ruleset === id) return single;
  return null;
}

function parseGlobalVariantKeysFromEnv(): string[] | undefined {
  const raw = process.env.CPQ_GLOBAL_VARIANT_KEYS_JSON?.trim();
  if (!raw) return undefined;
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return undefined;
    return arr.filter((x): x is string => typeof x === "string");
  } catch {
    logCpqDebug("CPQ_GLOBAL_VARIANT_KEYS_JSON is not valid JSON — ignoring");
    return undefined;
  }
}

export function variantKeysForEntry(entry: RulesetEntry): string[] {
  if (entry.variantKeys && entry.variantKeys.length > 0) return entry.variantKeys;
  const g = parseGlobalVariantKeysFromEnv();
  if (g && g.length > 0) return g;
  return [""];
}

// ---------------------------------------------------------------------------
// Main catalogue response builder
// ---------------------------------------------------------------------------

/**
 * Each entry in CPQ_RULESETS_JSON is one bike type (ruleset). By default one catalogue card per entry
 * (baseline StartConfiguration). Set CPQ_CATALOGUE_FANOUT_VARIANT_KEYS=1 and CPQ_GLOBAL_VARIANT_KEYS_JSON
 * (or per-entry variantKeys) to emit one card per Design Studio variant key.
 *
 * If CPQ_RULESETS_JSON is not set the single ruleset from CPQ_RULESET / CPQ_NAMESPACE /
 * CPQ_HEADER_ID is used and the line/electric category is read from the CPQ response.
 *
 * In mock mode a single generic card is returned without hitting Infor.
 */
export async function buildCatalogueResponse(category: CatalogueCategory): Promise<CatalogueApiResponse> {
  const integrationParameters = mergeCpqIntegrationParameters(parseCpqIntegrationParametersFromEnv(), []);

  // ── Mock mode ────────────────────────────────────────────────────────────
  if (isMockMode()) {
    logCpqDebug("mock: catalogue returning mock card — set CPQ_API_KEY for live data");
    const norm = mockNormalizedState();
    const line = lineFromNorm(norm);
    const isElectric = isElectricFromNorm(norm);
    const card: BikeSkuCard = {
      id: "mock-bike",
      bikeTypeId: "mock-bike",
      title: `${FAMILY_LABEL[line]} (mock)`,
      subtitle: "Mock configuration — set CPQ_API_KEY for live data",
      modelCode: "MOCK-001",
      familyLabel: FAMILY_LABEL[line],
      isElectric,
      tradePrice: norm.configuredPrice || null,
      msrp: null,
      currencyCode: undefined,
      highlights: highlightsFromNormalizedState(norm, 5),
      configureQuery: { ruleset: "mock", namespace: "mock", headerId: "mock" },
    };
    return { ok: true, mock: true, category, cards: [card] };
  }

  // ── Live mode: validate required env vars ────────────────────────────────
  const missing = missingLiveEnvVars();
  if (missing.length > 0) {
    return {
      ok: false,
      category,
      cards: [],
      error: `Missing required env vars: ${missing.join(", ")}`,
    };
  }

  const rulesets = getRulesetsFromEnv();

  // ── Single ruleset (CPQ_RULESETS_JSON not set) ───────────────────────────
  if (rulesets.length === 0) {
    const entry = singleRulesetFromEnv();
    const slices = catalogueVariantKeySlices(entry);
    const cards: BikeSkuCard[] = [];
    const errors: string[] = [];

    for (const vk of slices) {
      const vkOpt = vk.trim() || undefined;
      try {
        const { status, data } = await cpqStartForRulesetEntry(entry, integrationParameters, vkOpt);
        if (status < 200 || status >= 300) {
          const hint = describeCpqStartFailure(data);
          errors.push(hint ?? `${entry.ruleset}${vkOpt ? ` (${vkOpt})` : ""}: CPQ ${status}`);
          continue;
        }
        const norm = normalizeConfiguratorResponse(data);
        entry.line = lineFromNorm(norm);
        entry.isElectric = isElectricFromNorm(norm);

        const baseTitle =
          norm.productDescription || `${FAMILY_LABEL[entry.line]}${entry.isElectric ? " Electric" : ""}`;
        const title = vkOpt ? `${baseTitle} — ${vkOpt}` : baseTitle;
        const cardId = vkOpt ? `${entry.id}:${vkOpt}` : entry.id;
        cards.push(cardFromNorm(cardId, entry.id, norm, entry, title, vkOpt));
      } catch (e) {
        errors.push(`${entry.ruleset}${vkOpt ? ` (${vkOpt})` : ""}: ${e instanceof Error ? e.message : "error"}`);
      }
    }

    if (cards.length === 0) {
      return {
        ok: false,
        category,
        cards: [],
        error: errors[0] ?? "CPQ start failed",
        ...(errors.length > 1 ? { errors } : {}),
      };
    }

    return {
      ok: true,
      mock: false,
      category,
      cards,
      ...(errors.length ? { errors } : {}),
    };
  }

  // ── Multiple rulesets from CPQ_RULESETS_JSON ─────────────────────────────
  const filtered = rulesets.filter((r) => matchesCategory(category, r));
  if (filtered.length === 0) {
    return { ok: true, category, cards: [] };
  }

  const cards: BikeSkuCard[] = [];
  const errors: string[] = [];

  for (const entry of filtered) {
    const slices = catalogueVariantKeySlices(entry);
    for (const vk of slices) {
      const vkOpt = vk.trim() || undefined;
      try {
        const { status, data } = await cpqStartForRulesetEntry(entry, integrationParameters, vkOpt);
        if (status >= 200 && status < 300) {
          const norm = normalizeConfiguratorResponse(data);
          const baseTitle =
            entry.displayTitle ||
            norm.productDescription ||
            `${FAMILY_LABEL[entry.line]}${entry.isElectric ? " Electric" : ""}`;
          const title = vkOpt ? `${baseTitle} — ${vkOpt}` : baseTitle;
          const cardId = vkOpt ? `${entry.id}:${vkOpt}` : entry.id;
          cards.push(cardFromNorm(cardId, entry.id, norm, entry, title, vkOpt));
        } else {
          const hint = describeCpqStartFailure(data);
          errors.push(hint ?? `${entry.ruleset}${vkOpt ? ` (${vkOpt})` : ""}: CPQ ${status}`);
        }
      } catch (e) {
        errors.push(`${entry.ruleset}${vkOpt ? ` (${vkOpt})` : ""}: ${e instanceof Error ? e.message : "unknown error"}`);
      }
    }
  }

  return {
    ok: true,
    mock: false,
    category,
    cards,
    ...(errors.length ? { errors } : {}),
  };
}
