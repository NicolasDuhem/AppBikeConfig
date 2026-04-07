const ATTRIBUTE_OPTION_COLUMN_MAP = [
  ['CPQRuleset', 'cpq_ruleset'],
  ['ProductAssist', 'product_assist'],
  ['ProductFamily', 'product_family'],
  ['ProductLine', 'product_line'],
  ['ProductModel', 'product_model'],
  ['ProductType', 'product_type'],
  ['BrakeReverse', 'brake_reverse'],
  ['BrakeNonReverse', 'brake_non_reverse'],
  ['Description', 'description'],
  ['HandlebarType', 'handlebar_type'],
  ['Speeds', 'speeds'],
  ['MudguardsAndRack', 'mudguards_and_rack'],
  ['Territory', 'territory'],
  ['MainFrameColour', 'main_frame_colour'],
  ['RearFrameColour', 'rear_frame_colour'],
  ['FrontCarrierBlock', 'front_carrier_block'],
  ['Lighting', 'lighting'],
  ['SaddleHeight', 'saddle_height'],
  ['GearRatio', 'gear_ratio'],
  ['Saddle', 'saddle'],
  ['Tyre', 'tyre'],
  ['Brakes', 'brakes'],
  ['Pedals', 'pedals'],
  ['Saddlebag', 'saddlebag'],
  ['Suspension', 'suspension'],
  ['BikeType', 'bike_type'],
  ['Toolkit', 'toolkit'],
  ['SaddleLight', 'saddle_light'],
  ['ConfigCode', 'config_code'],
  ['OptionBox', 'option_box'],
  ['FrameMaterial', 'frame_material'],
  ['FrameSet', 'frame_set'],
  ['ComponentColour', 'component_colour'],
  ['OnBikeAccessories', 'on_bike_accessories'],
  ['HandlebarStemColour', 'handlebar_stem_colour'],
  ['HandlebarPinColour', 'handlebar_pin_colour'],
  ['FrontFrameColour', 'front_frame_colour'],
  ['FrontForkColour', 'front_fork_colour']
] as const;

export type CpqAttributeOptionName = typeof ATTRIBUTE_OPTION_COLUMN_MAP[number][0];
export const CPQ_ATTRIBUTE_OPTION_NAMES = ATTRIBUTE_OPTION_COLUMN_MAP.map(([optionName]) => optionName);

function pick(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null) return String(value).trim();
  }
  return '';
}

export function buildCpqAttributeEntries(row: Record<string, unknown>) {
  return ATTRIBUTE_OPTION_COLUMN_MAP
    .map(([optionName, column]) => ({
      optionName,
      value: pick(row, [optionName, column])
    }))
    .filter((entry) => entry.value.length > 0);
}

export function importRowCacheKey(optionName: string, choiceValue: string) {
  return `${String(optionName || '').trim().toLowerCase()}|${String(choiceValue || '').trim().toLowerCase()}`;
}
