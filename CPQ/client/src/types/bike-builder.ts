export type SelectableOption = {
  optionId: string;
  caption: string;
  value: string;
  unitWeight?: number;
  msrp?: number;
  price?: number;
  featureId?: number;
  ipnCode?: string;
};

export type FeatureField = {
  featureKey: string;
  cpqOptionId: string;
  label: string;
  displayType: string;
  isVisible: boolean;
  isEnabled: boolean;
  options: SelectableOption[];
  selectedValue: string;
  selectedCaption: string;
};

export type NormalizedState = {
  sessionId: string;
  isExecutionComplete: boolean;
  configuredPrice: number;
  currencyCode?: string;
  productDescription: string;
  productCode: string;
  weightKg: number | null;
  msrp: number | null;
  tradePrice: number | null;
  features: FeatureField[];
  messages: { type: string; value: string }[];
};

/** Per-feature list of CPQ choices (same data as `features[].options`, explicit for API consumers). */
export type FeatureVariants = {
  featureKey: string;
  cpqOptionId: string;
  label: string;
  displayType: string;
  isVisible: boolean;
  isEnabled: boolean;
  selectedValue: string;
  selectedCaption: string;
  variants: SelectableOption[];
};

/** Body for POST /api/cpq/start (subset; server validates with Zod). */
export type CpqStartBody = {
  partName?: string;
  partNamespace?: string;
  headerId?: string;
  detailId?: string;
  sourceHeaderId?: string;
  sourceDetailId?: string;
  variantKey?: string;
};

export type CpqStartResponse = {
  ok: boolean;
  mock?: boolean;
  state?: NormalizedState;
  variants?: FeatureVariants[];
  error?: string;
};
export type CpqConfigureResponse = {
  ok: boolean;
  mock?: boolean;
  clientRequestId?: string;
  state?: NormalizedState;
  variants?: FeatureVariants[];
  error?: string;
};

export type CatalogueCategory =
  | "all-bikes"
  | "c-line"
  | "p-line"
  | "g-line"
  | "t-line"
  | "special-editions"
  | "electric"
  | "electric-c-line"
  | "electric-p-line"
  | "electric-g-line"
  | "electric-t-line";

export const CATALOGUE_CATEGORIES: readonly CatalogueCategory[] = [
  "all-bikes",
  "c-line",
  "p-line",
  "g-line",
  "t-line",
  "special-editions",
  "electric",
  "electric-c-line",
  "electric-p-line",
  "electric-g-line",
  "electric-t-line",
] as const;

export function isCatalogueCategory(s: string): s is CatalogueCategory {
  return (CATALOGUE_CATEGORIES as readonly string[]).includes(s);
}

export type BikeSkuCard = {
  id: string;
  /** Ruleset row id from CPQ_RULESETS_JSON — use for /variants/:bikeTypeId. */
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

/** One paginated row from GET /api/cpq/configuration-variants (CPQ StartConfiguration per variant key). */
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

