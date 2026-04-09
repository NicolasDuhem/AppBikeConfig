/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FeatureField, FeatureVariants, NormalizedState } from '@/lib/cpq-integration/contracts';

function getProp<T>(obj: Record<string, unknown> | undefined, a: string, b: string): T | undefined {
  if (!obj) return undefined;
  if (obj[a] != null) return obj[a] as T;
  if (obj[b] != null) return obj[b] as T;
  return undefined;
}

function parseNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function findCustomProperty(props: any[] | undefined, name: string): string | undefined {
  if (!Array.isArray(props)) return undefined;
  const hit = props.find((item) => String(getProp(item, 'name', 'Name') ?? '').toLowerCase() === name.toLowerCase());
  const value = hit ? getProp<string>(hit, 'value', 'Value') : undefined;
  return value ? String(value) : undefined;
}

function detailRows(raw: any): any[] {
  const details = raw?.details ?? raw?.Details ?? [];
  const summary = raw?.selectionSummary ?? raw?.SelectionSummary ?? [];
  return [...(Array.isArray(details) ? details : []), ...(Array.isArray(summary) ? summary : [])];
}

function findDetailValue(rows: any[], labels: string[]): string {
  const normalized = new Set(labels.map((label) => label.toLowerCase()));
  for (const row of rows) {
    const caption = String(getProp(row, 'caption', 'Caption') ?? '').trim().toLowerCase();
    if (!caption || !normalized.has(caption)) continue;
    const value = String(getProp(row, 'value', 'Value') ?? '').trim();
    if (value) return value;
  }
  return '';
}

export function variantsFromNormalizedState(state: NormalizedState): FeatureVariants[] {
  return state.features.map((feature) => ({
    featureKey: feature.featureKey,
    cpqOptionId: feature.cpqOptionId,
    label: feature.label,
    displayType: feature.displayType,
    isVisible: feature.isVisible,
    isEnabled: feature.isEnabled,
    selectedValue: feature.selectedValue,
    selectedCaption: feature.selectedCaption,
    variants: feature.options
  }));
}

export function normalizeConfiguratorResponse(raw: any): NormalizedState {
  const rows = detailRows(raw);
  const pages: any[] = raw?.pages ?? raw?.Pages ?? [];

  const features: FeatureField[] = [];
  for (const page of pages) {
    const screens: any[] = page?.screens ?? page?.Screens ?? [];
    for (const screen of screens) {
      const options: any[] = screen?.screenOptions ?? screen?.ScreenOptions ?? [];
      const displayType = String(getProp(options[0], 'displayType', 'DisplayType') ?? 'DropDownList');

      for (const option of options) {
        const cpqOptionId = String(getProp(option, 'id', 'ID') ?? '');
        const label = String(getProp(option, 'caption', 'Caption') ?? getProp(option, 'name', 'Name') ?? 'Option').trim();
        const currentValue = String(getProp(option, 'value', 'Value') ?? '');
        const selectableValues: any[] = option?.selectableValues ?? option?.SelectableValues ?? [];

        const mapped = selectableValues.map((value: any, index: number) => {
          const custom = value?.customProperties ?? value?.CustomProperties;
          const val = String(findCustomProperty(custom, 'LongDescription') ?? getProp(value, 'value', 'Value') ?? '');
          return {
            optionId: findCustomProperty(custom, 'OptionID') || `${cpqOptionId}-${index}`,
            caption: String(getProp(value, 'caption', 'Caption') ?? val),
            value: val,
            unitWeight: parseNumber(findCustomProperty(custom, 'UnitWeight')),
            msrp: parseNumber(findCustomProperty(custom, 'MSRP') ?? findCustomProperty(custom, 'Price')),
            price: parseNumber(findCustomProperty(custom, 'Price')),
            featureId: parseNumber(findCustomProperty(custom, 'FeatureID')),
            ipnCode: findCustomProperty(custom, 'IPNCode')?.trim() || undefined,
            forecastAs: findCustomProperty(custom, 'ForecastAs')?.trim() || undefined
          };
        });

        const selected = mapped.find((item) => item.value === currentValue) ?? mapped[0];
        features.push({
          featureKey: `${cpqOptionId}:${label}`,
          cpqOptionId,
          label,
          displayType,
          isVisible: Boolean(getProp(option, 'isVisible', 'IsVisible') ?? true),
          isEnabled: Boolean(getProp(option, 'isEnabled', 'IsEnabled') ?? true),
          options: mapped,
          selectedValue: selected?.value ?? currentValue,
          selectedCaption: selected?.caption ?? currentValue
        });
      }
    }
  }

  const configuredPrice = Number(raw?.configuredPrice ?? raw?.ConfiguredPrice ?? 0) || 0;
  const currencyCode = String(raw?.currencyCode ?? raw?.CurrencyCode ?? '').trim() || undefined;
  const productDescription = findDetailValue(rows, ['Description', 'Product description', 'Configuration description']);
  const productCode = findDetailValue(rows, ['IPN Code', 'IPNCode', 'Product code', 'Product Code']);

  let totalWeight = 0;
  let weightFound = false;
  let totalMsrp = 0;
  let msrpFound = false;
  for (const feature of features) {
    const selected = feature.options.find((option) => option.value === feature.selectedValue);
    if (selected?.unitWeight != null) {
      totalWeight += selected.unitWeight;
      weightFound = true;
    }
    if (selected?.msrp != null) {
      totalMsrp += selected.msrp;
      msrpFound = true;
    }
  }

  return {
    sessionId: String(raw?.sessionID ?? raw?.SessionID ?? ''),
    isExecutionComplete: Boolean(raw?.isExecutionComplete ?? raw?.IsExecutionComplete),
    configuredPrice,
    currencyCode,
    productDescription,
    productCode,
    weightKg: weightFound ? totalWeight : null,
    msrp: msrpFound ? totalMsrp : null,
    tradePrice: configuredPrice || null,
    features,
    messages: Array.isArray(raw?.messages ?? raw?.Messages)
      ? (raw?.messages ?? raw?.Messages).map((message: any) => ({
          type: String(getProp(message, 'type', 'Type') ?? 'Message'),
          value: String(getProp(message, 'value', 'Value') ?? '')
        }))
      : [],
    raw
  };
}

export function highlightsFromNormalizedState(state: NormalizedState, max = 4): string[] {
  const highlights: string[] = [];
  for (const feature of state.features) {
    if (!feature.isVisible) continue;
    const selected = (feature.selectedCaption || feature.selectedValue || '').trim();
    if (!selected) continue;
    highlights.push(`${feature.label}: ${selected}`);
    if (highlights.length >= max) break;
  }
  return highlights;
}

export function mockNormalizedState(): NormalizedState {
  const features: FeatureField[] = [
    {
      featureKey: 'mock-bike-type', cpqOptionId: 'bike-type', label: 'Bike type', displayType: 'DropDownList', isVisible: true, isEnabled: true,
      options: [
        { optionId: 'bike-1', caption: 'C Line Electric', value: 'c-line-electric' },
        { optionId: 'bike-2', caption: 'C Line Explore', value: 'c-line-explore' }
      ], selectedValue: 'c-line-electric', selectedCaption: 'C Line Electric'
    },
    {
      featureKey: 'mock-gear', cpqOptionId: 'gear', label: 'Gears', displayType: 'DropDownList', isVisible: true, isEnabled: true,
      options: [
        { optionId: 'gear-4', caption: '4-speed', value: '4-speed', msrp: 0 },
        { optionId: 'gear-6', caption: '6-speed', value: '6-speed', msrp: 120 }
      ], selectedValue: '4-speed', selectedCaption: '4-speed'
    }
  ];

  return {
    sessionId: 'mock-session',
    isExecutionComplete: true,
    configuredPrice: 1099,
    currencyCode: 'GBP',
    productDescription: 'Mock Brompton configuration',
    productCode: 'MOCK-001',
    weightKg: 11.2,
    msrp: 2100,
    tradePrice: 1099,
    features,
    messages: [],
    raw: { mock: true }
  };
}

export function applyMockSelections(base: NormalizedState, selections: Array<{ id: string; value: string }>): NormalizedState {
  const next: NormalizedState = JSON.parse(JSON.stringify(base));
  for (const selection of selections) {
    const feature = next.features.find((item) => item.cpqOptionId === selection.id);
    if (!feature) continue;
    const chosen = feature.options.find((option) => option.value === selection.value);
    feature.selectedValue = selection.value;
    feature.selectedCaption = chosen?.caption ?? selection.value;
  }
  return next;
}
