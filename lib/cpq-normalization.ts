export type CpqOptionDefinition = { csv: string; key: string; aliases?: string[] };

export const CPQ_OPTION_DEFINITIONS: CpqOptionDefinition[] = [
  { csv: 'CPQRuleset', key: 'cpq_ruleset' },
  { csv: 'ProductAssist', key: 'product_assist' },
  { csv: 'ProductFamily', key: 'product_family' },
  { csv: 'ProductLine', key: 'product_line' },
  { csv: 'ProductModel', key: 'product_model' },
  { csv: 'ProductType', key: 'product_type' },
  { csv: 'BrakeReverse', key: 'brake_reverse' },
  { csv: 'BrakeNonReverse', key: 'brake_non_reverse' },
  { csv: 'SKU code', key: 'sku_code' },
  { csv: 'Description', key: 'description' },
  { csv: 'HandlebarType', key: 'handlebar_type' },
  { csv: 'Speeds', key: 'speeds' },
  { csv: 'MudguardsAndRack', key: 'mudguards_and_rack', aliases: ['MudguardsandRack', 'Mudguards and Rack'] },
  { csv: 'Territory', key: 'territory' },
  { csv: 'MainFrameColour', key: 'main_frame_colour' },
  { csv: 'RearFrameColour', key: 'rear_frame_colour' },
  { csv: 'FrontCarrierBlock', key: 'front_carrier_block' },
  { csv: 'Lighting', key: 'lighting' },
  { csv: 'SaddleHeight', key: 'saddle_height' },
  { csv: 'GearRatio', key: 'gear_ratio' },
  { csv: 'Saddle', key: 'saddle' },
  { csv: 'Tyre', key: 'tyre' },
  { csv: 'Brakes', key: 'brakes' },
  { csv: 'Pedals', key: 'pedals' },
  { csv: 'Saddlebag', key: 'saddlebag', aliases: ['SaddleBag'] },
  { csv: 'Suspension', key: 'suspension' },
  { csv: 'BikeType', key: 'bike_type' },
  { csv: 'Toolkit', key: 'toolkit' },
  { csv: 'SaddleLight', key: 'saddle_light' },
  { csv: 'ConfigCode', key: 'config_code' },
  { csv: 'OptionBox', key: 'option_box' },
  { csv: 'FrameMaterial', key: 'frame_material' },
  { csv: 'FrameSet', key: 'frame_set' },
  { csv: 'ComponentColour', key: 'component_colour' },
  { csv: 'OnBikeAccessories', key: 'on_bike_accessories' },
  { csv: 'HandlebarStemColour', key: 'handlebar_stem_colour' },
  { csv: 'HandlebarPinColour', key: 'handlebar_pin_colour' },
  { csv: 'FrontFrameColour', key: 'front_frame_colour' },
  { csv: 'FrontForkColour', key: 'front_fork_colour' },
  { csv: 'Position29', key: 'position29' },
  { csv: 'Position30', key: 'position30' }
] as const;

const optionByNormalizedName = new Map<string, CpqOptionDefinition>();

export function normalizeOptionName(value: string) {
  return String(value || '').trim().toLowerCase();
}

for (const definition of CPQ_OPTION_DEFINITIONS) {
  optionByNormalizedName.set(normalizeOptionName(definition.csv), definition);
  for (const alias of definition.aliases || []) {
    optionByNormalizedName.set(normalizeOptionName(alias), definition);
  }
}

export const CPQ_OPTION_NAMES = CPQ_OPTION_DEFINITIONS.map((option) => option.csv);
export const CPQ_COLUMNS = CPQ_OPTION_NAMES;

export function mapOptionNameToCanonical(value: string) {
  return optionByNormalizedName.get(normalizeOptionName(value))?.csv || null;
}

export function optionScopeKey(optionName: string, digitPosition?: number | null, codeValue?: string | null) {
  const canonicalOption = mapOptionNameToCanonical(optionName) || String(optionName || '').trim();
  const normalizedDigit = Number(digitPosition || 0);
  const normalizedCode = normalizedDigit === 0 ? '-' : String(codeValue || '').trim().toUpperCase();
  return `${normalizedDigit}|${normalizedCode}|${normalizeOptionName(canonicalOption)}`;
}
