/* eslint-disable @typescript-eslint/no-explicit-any -- CPQ JSON is loosely typed */

export type SelectableOption = {
  optionId: string;
  caption: string;
  value: string;
  unitWeight?: number;
  msrp?: number;
  price?: number;
  featureId?: number;
  /** Per-option IPN position code from CPQ custom properties. When options within a feature
   *  have distinct non-empty values here, the feature is model-defining (changes the product IPN). */
  ipnCode?: string;
  /** Demand-forecast code from CPQ custom properties. Non-empty means this option is tracked
   *  commercially as a distinct product — a strong signal that the feature is model-defining. */
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
  raw: unknown;
};

/** One configurable dimension with all CPQ choices (`selectableValues`) for that option. */
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

export function variantsFromNormalizedState(state: NormalizedState): FeatureVariants[] {
  return state.features.map((f) => ({
    featureKey: f.featureKey,
    cpqOptionId: f.cpqOptionId,
    label: f.label,
    displayType: f.displayType,
    isVisible: f.isVisible,
    isEnabled: f.isEnabled,
    selectedValue: f.selectedValue,
    selectedCaption: f.selectedCaption,
    variants: f.options,
  }));
}

const TRAILING_PRICE_RE = /\s*-\s*[\d,.]+$/;

function stripTrailingPrice(caption: string): string {
  return caption.replace(TRAILING_PRICE_RE, "").trim();
}

function prop<T>(obj: Record<string, unknown> | undefined, a: string, b: string): T | undefined {
  if (obj == null) return undefined;
  if (a in obj && obj[a] !== undefined && obj[a] !== null) return obj[a] as T;
  if (b in obj && obj[b] !== undefined && obj[b] !== null) return obj[b] as T;
  return undefined;
}

function firstCustom(props: any[] | undefined, name: string): string | undefined {
  if (!props) return undefined;
  const want = name.toLowerCase();
  const p = props.find((x) => {
    const n = prop<string>(x, "name", "Name");
    return typeof n === "string" && n.toLowerCase() === want;
  });
  const v = p ? prop<string>(p, "value", "Value") : undefined;
  return v != null && v !== "" ? String(v) : undefined;
}

function normCaption(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

/** Merge CPQ detail panes; Infor may use PascalCase and split across details vs selectionSummary */
function collectDetailRows(raw: any): any[] {
  const a = raw?.details ?? raw?.Details ?? [];
  const b = raw?.selectionSummary ?? raw?.SelectionSummary ?? [];
  return [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])];
}

function findDetailValue(rows: any[], captions: string[]): string {
  const targets = new Set(captions.map((c) => normCaption(c)));
  for (const d of rows) {
    const cap = normCaption(prop(d, "caption", "Caption"));
    if (!cap || !targets.has(cap)) continue;
    const val = prop(d, "value", "Value");
    if (val != null && String(val).trim() !== "") return String(val).trim();
  }
  return "";
}

function parseNum(s: string | undefined): number | undefined {
  if (s == null || s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export function normalizeConfiguratorResponse(raw: any): NormalizedState {
  const sessionId = String(raw?.sessionID ?? raw?.SessionID ?? "");
  const isExecutionComplete = Boolean(raw?.isExecutionComplete ?? raw?.IsExecutionComplete);
  const configuredPrice = Number(raw?.configuredPrice ?? raw?.ConfiguredPrice ?? 0) || 0;
  const currencyCode = raw?.currencyCode ?? raw?.CurrencyCode;

  const detailRows = collectDetailRows(raw);
  let productDescription = findDetailValue(detailRows, ["Description"]);
  let productCode = findDetailValue(detailRows, ["IPN Code", "IPNCode", "Product code", "Product Code"]);
  if (!productDescription) {
    productDescription = findDetailValue(detailRows, ["Product description", "Short description", "Configuration description"]);
  }

  const pages: any[] = raw?.pages ?? raw?.Pages ?? [];
  const features: FeatureField[] = [];

  for (const page of pages) {
    const screens: any[] = page?.screens ?? page?.Screens ?? [];
    for (const screen of screens) {
      const screenOptions: any[] = screen?.screenOptions ?? screen?.ScreenOptions ?? [];
      let displayType = "";
      if (screenOptions[0]) {
        displayType = String(screenOptions[0]?.displayType ?? screenOptions[0]?.DisplayType ?? "");
      }

      for (const opt of screenOptions) {
        const cpqOptionId = String(opt?.id ?? opt?.ID ?? "");
        const caption = stripTrailingPrice(String(opt?.caption ?? opt?.Caption ?? opt?.name ?? opt?.Name ?? ""));
        const currentValue = String(opt?.value ?? opt?.Value ?? "");
        const selectable: SelectableOption[] = [];
        const vals: any[] = opt?.selectableValues ?? opt?.SelectableValues ?? [];

        for (const v of vals) {
          const optionId = firstCustom(v?.customProperties ?? v?.CustomProperties, "OptionID") ?? "";
          const featureId = parseNum(
            firstCustom(v?.customProperties ?? v?.CustomProperties, "FeatureID"),
          );
          const unitWeight = parseNum(
            firstCustom(v?.customProperties ?? v?.CustomProperties, "UnitWeight"),
          );
          const msrp = parseNum(firstCustom(v?.customProperties ?? v?.CustomProperties, "MSRP"));
          const price = parseNum(firstCustom(v?.customProperties ?? v?.CustomProperties, "Price"));
          const longDesc = firstCustom(v?.customProperties ?? v?.CustomProperties, "LongDescription");
          const ipnCode = firstCustom(v?.customProperties ?? v?.CustomProperties, "IPNCode");
          const forecastAs = firstCustom(v?.customProperties ?? v?.CustomProperties, "ForecastAs");
          selectable.push({
            optionId,
            caption: stripTrailingPrice(String(v?.caption ?? v?.Caption ?? "")),
            value: String(longDesc ?? prop(v, "value", "Value") ?? ""),
            unitWeight,
            msrp: msrp ?? price,
            price,
            featureId,
            ipnCode: ipnCode?.trim() || undefined,
            forecastAs: forecastAs?.trim() || undefined,
          });
        }

        const selected = selectable.find((s) => s.value === currentValue) ?? selectable[0];
        features.push({
          featureKey: `${cpqOptionId}:${caption}`,
          cpqOptionId,
          label: caption || "Option",
          displayType,
          isVisible: Boolean(opt?.isVisible ?? opt?.IsVisible ?? true),
          isEnabled: Boolean(opt?.isEnabled ?? opt?.IsEnabled ?? true),
          options: selectable,
          selectedValue: selected?.value ?? currentValue,
          selectedCaption: selected?.caption ?? "",
        });
      }
    }
  }

  let totalWeight = 0;
  let totalMsrp = 0;
  let hasWeight = false;
  let hasMsrp = false;
  for (const f of features) {
    const sel = f.options.find((o) => o.value === f.selectedValue);
    if (sel?.unitWeight != null) {
      totalWeight += sel.unitWeight;
      hasWeight = true;
    }
    if (sel?.msrp != null) {
      totalMsrp += sel.msrp;
      hasMsrp = true;
    }
  }

  let weightKg: number | null = hasWeight ? totalWeight : null;
  if (weightKg == null) {
    const wStr = findDetailValue(detailRows, ["Weight", "Total weight", "Total Weight", "Bike weight", "Unit weight"]);
    const w = parseNum(wStr);
    if (w != null) weightKg = w;
    else {
      const rw = prop<number | string>(raw, "totalWeight", "TotalWeight");
      const parsed = typeof rw === "number" ? rw : parseNum(String(rw ?? ""));
      if (parsed != null) weightKg = parsed;
    }
  }

  let msrp: number | null = hasMsrp ? totalMsrp : null;
  if (msrp == null) {
    const mStr = findDetailValue(detailRows, ["MSRP", "List price", "List Price", "RRP", "Retail price"]);
    const m = parseNum(mStr);
    if (m != null) msrp = m;
    else {
      for (const key of ["totalMsrp", "TotalMsrp", "listPrice", "ListPrice", "msrp", "MSRP"] as const) {
        const parsed = parseNum(String((raw as Record<string, unknown>)[key] ?? ""));
        if (parsed != null) {
          msrp = parsed;
          break;
        }
      }
    }
  }

  if (!productDescription && features.length > 0) {
    productDescription = features
      .filter((f) => f.isVisible)
      .map((f) => f.selectedCaption || f.selectedValue)
      .filter((s) => s.trim() !== "")
      .join(" / ");
  }

  if (!productCode) {
    const fromOptions = new Set<string>();
    for (const f of features) {
      const sel = f.options.find((o) => o.value === f.selectedValue);
      const c = sel?.ipnCode?.trim();
      if (c) fromOptions.add(c);
    }
    if (fromOptions.size === 1) {
      productCode = [...fromOptions][0]!;
    }
  }

  const msgsRaw = raw?.messages ?? raw?.Messages ?? [];
  const messages = (msgsRaw as any[]).map((m) => ({
    type: String(m?.type ?? m?.Type ?? "Message"),
    value: String(m?.value ?? m?.Value ?? ""),
  }));

  return {
    sessionId,
    isExecutionComplete,
    configuredPrice,
    currencyCode,
    productDescription,
    productCode,
    weightKg,
    msrp,
    tradePrice: isExecutionComplete ? configuredPrice : null,
    features,
    messages,
    raw,
  };
}

const HIGHLIGHT_SKIP = new Set(
  [
    "bike type",
    "main frame colour",
    "rear frame colour",
    "saddle height",
  ].map((s) => s.toLowerCase()),
);

/** Short bullet highlights from visible CPQ features (for catalogue cards). */
export function highlightsFromNormalizedState(state: NormalizedState, max = 4): string[] {
  const out: string[] = [];
  for (const f of state.features) {
    if (!f.isVisible) continue;
    const label = f.label.trim().toLowerCase();
    if (!label || HIGHLIGHT_SKIP.has(label)) continue;
    const cap = (f.selectedCaption || f.selectedValue).trim();
    if (!cap) continue;
    out.push(`${f.label}: ${cap}`);
    if (out.length >= max) break;
  }
  return out;
}

function opt(
  id: string,
  label: string,
  choices: { caption: string; value: string; w?: number; m?: number; p?: number }[],
  selected: string,
): FeatureField {
  return {
    featureKey: `mock-${id}`,
    cpqOptionId: id,
    label,
    displayType: "DropDownList",
    isVisible: true,
    isEnabled: true,
    options: choices.map((c, i) => ({
      optionId: `${id}-${i}`,
      caption: c.caption,
      value: c.value,
      unitWeight: c.w,
      msrp: c.m,
      price: c.p,
    })),
    selectedValue: selected,
    selectedCaption: choices.find((c) => c.value === selected)?.caption ?? selected,
  };
}

export function mockNormalizedState(): NormalizedState {
  const features: FeatureField[] = [
    opt("bike-type", "Bike type", [
      { caption: "C Line Electric", value: "c-line-e" },
      { caption: "C Line Explore", value: "c-line-x" },
    ], "c-line-e"),
    opt("gears", "Gears", [
      { caption: "4-speed", value: "4s", w: 0.1 },
      { caption: "6-speed", value: "6s", w: 0.2, m: 100 },
    ], "4s"),
    opt("wheel", "Wheel size", [
      { caption: "12 inch", value: "12" },
      { caption: "16 inch", value: "16", m: 50 },
    ], "12"),
    opt("main-frame", "Main frame colour", [
      { caption: "Black", value: "m-bk" },
      { caption: "Raw lacquer", value: "m-raw", m: 80 },
    ], "m-bk"),
    opt("rear-frame", "Rear frame colour", [
      { caption: "Black", value: "r-bk" },
      { caption: "Orange", value: "r-or", m: 40 },
    ], "r-bk"),
    opt("handlebar", "Handlebar", [
      { caption: "High", value: "hb-hi" },
      { caption: "Mid", value: "hb-mid", m: 25 },
    ], "hb-hi"),
    opt("lights", "Lights", [
      { caption: "Dynamo", value: "dyn" },
      { caption: "Battery", value: "bat", m: 35 },
    ], "dyn"),
    opt("rack", "Rack", [
      { caption: "Rear rack", value: "rack-r" },
      { caption: "No rack", value: "rack-n" },
    ], "rack-r"),
    opt("saddle", "Saddle", [
      { caption: "Standard", value: "sad-std" },
      { caption: "Brooks", value: "sad-br", m: 120 },
    ], "sad-std"),
    opt("saddle-h", "Saddle height", [
      { caption: "Standard", value: "sh-std" },
      { caption: "Extended", value: "sh-ext", m: 15 },
    ], "sh-std"),
    opt("tyre", "Tyre", [
      { caption: "Standard", value: "tyre-std" },
      { caption: "Schwalbe", value: "tyre-sch", m: 45 },
    ], "tyre-std"),
  ];

  let totalW = 0;
  let totalM = 0;
  for (const f of features) {
    const sel = f.options.find((o) => o.value === f.selectedValue);
    if (sel?.unitWeight != null) totalW += sel.unitWeight;
    if (sel?.msrp != null) totalM += sel.msrp;
  }

  return {
    sessionId: "mock-session",
    isExecutionComplete: true,
    configuredPrice: 1054.81,
    currencyCode: "GBP",
    productDescription: "MI2L/mBK/rBK/FCB/50TREV/CmK6/St/",
    productCode: "MLL0BBB00B00R000C0070I20BBB00",
    weightKg: 11.5 + totalW,
    msrp: 2000 + totalM,
    tradePrice: 1054.81,
    features,
    messages: [],
    raw: { mock: true },
  };
}

export function applyMockSelections(
  base: NormalizedState,
  selections: { id: string; value: string }[],
): NormalizedState {
  const features = base.features.map((f) => ({ ...f, options: f.options.map((o) => ({ ...o })) }));
  for (const sel of selections) {
    const f = features.find((x) => x.cpqOptionId === sel.id);
    if (f) {
      const opt = f.options.find((o) => o.value === sel.value);
      f.selectedValue = sel.value;
      f.selectedCaption = opt?.caption ?? sel.value;
    }
  }
  let totalW = 0;
  let totalM = 0;
  for (const f of features) {
    const s = f.options.find((o) => o.value === f.selectedValue);
    if (s?.unitWeight != null) totalW += s.unitWeight;
    if (s?.msrp != null) totalM += s.msrp;
  }
  return {
    ...base,
    features,
    weightKg: 11.5 + totalW,
    msrp: 2000 + totalM,
    tradePrice: 1040 + totalM * 0.35,
    configuredPrice: 1040 + totalM * 0.35,
  };
}
