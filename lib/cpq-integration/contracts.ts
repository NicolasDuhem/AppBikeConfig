export const CATALOGUE_CATEGORIES = [
  'all-bikes',
  'c-line',
  'p-line',
  'g-line',
  't-line',
  'special-editions',
  'electric',
  'electric-c-line',
  'electric-p-line',
  'electric-g-line',
  'electric-t-line'
] as const;

export type CatalogueCategory = (typeof CATALOGUE_CATEGORIES)[number];

export function isCatalogueCategory(value: string): value is CatalogueCategory {
  return (CATALOGUE_CATEGORIES as readonly string[]).includes(value);
}

export type CpqIntegrationParameter = {
  name: string;
  simpleValue?: string;
  isNull?: boolean;
  type?: string;
};

export type StartBody = {
  partName?: string;
  partNamespace?: string;
  headerId?: string;
  detailId?: string;
  sourceHeaderId?: string;
  sourceDetailId?: string;
  variantKey?: string;
  integrationParameters?: CpqIntegrationParameter[];
};

export type ConfigureBody = {
  selections: Array<{ id: string; value: string }>;
  clientRequestId?: string;
};

export type SelectableOption = {
  optionId: string;
  caption: string;
  value: string;
  unitWeight?: number;
  msrp?: number;
  price?: number;
  featureId?: number;
  ipnCode?: string;
  forecastAs?: string;
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
  raw?: unknown;
};

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

export type BikeSkuCard = {
  id: string;
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
  configureQuery: {
    ruleset: string;
    namespace: string;
    headerId: string;
    variantKey?: string;
  };
};

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
