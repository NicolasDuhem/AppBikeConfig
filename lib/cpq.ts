import type { SkuRule } from '@/lib/types';

type CpqOptionDefinition = { csv: string; key: string; aliases?: string[] };

const CPQ_OPTION_DEFINITIONS: CpqOptionDefinition[] = [
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
  { csv: 'Saddlebag', key: 'saddlebag' },
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

const OPTION_BY_NORMALIZED_NAME = new Map<string, CpqOptionDefinition>();
for (const definition of CPQ_OPTION_DEFINITIONS) {
  OPTION_BY_NORMALIZED_NAME.set(normalizeOptionName(definition.csv), definition);
  for (const alias of definition.aliases || []) {
    OPTION_BY_NORMALIZED_NAME.set(normalizeOptionName(alias), definition);
  }
}

export const CPQ_OPTION_NAMES = CPQ_OPTION_DEFINITIONS.map((option) => option.csv);
export const CPQ_COLUMNS = CPQ_OPTION_NAMES;

export type CpqMetadata = {
  selectedLine: 'C Line' | 'P Line' | 'T Line' | 'G Line' | 'A Line';
  electricType: 'Non electric' | 'Electric';
  isSpecial: boolean;
  specialEditionName?: string;
  character17: string;
  fileName: string;
};

export type ParsedCsvRow = {
  rowNumber: number;
  rawOptionName: string;
  optionName: string;
  choiceValue: string;
  digitPosition: number;
  codeValue: string;
};

export function normalizeCharacter17(value: string) {
  return String(value || '').trim().toUpperCase();
}

export function isValidCharacter17(value: string) {
  return /^[A-Z0-9]$/.test(normalizeCharacter17(value));
}

export function normalizeOptionName(value: string) {
  return String(value || '').trim().toLowerCase();
}

export function mapCsvOptionNameToCanonical(value: string) {
  const definition = OPTION_BY_NORMALIZED_NAME.get(normalizeOptionName(value));
  return definition?.csv || null;
}

export function parseSimpleCsv(content: string) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const rows: ParsedCsvRow[] = [];

  lines.forEach((line, index) => {
    const cols = line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
    const rawOptionName = String(cols[0] || '').trim();
    const canonicalOptionName = mapCsvOptionNameToCanonical(rawOptionName) || rawOptionName;
    const choiceValue = String(cols[1] || '').trim();
    const digitPosition = Number(cols[2] || 0);
    const codeValue = String(cols[3] || '').trim().toUpperCase();
    rows.push({ rowNumber: index + 1, rawOptionName, optionName: canonicalOptionName, choiceValue, digitPosition, codeValue });
  });

  return rows;
}

export function buildCpqCombinations(rules: SkuRule[], metadata: CpqMetadata) {
  const staticAttributes = new Map<string, string>();
  const nonStaticRules = rules.filter((rule) => {
    if (Number(rule.digit_position) !== 0) return true;
    const canonicalOption = mapCsvOptionNameToCanonical(rule.option_name) || rule.option_name;
    if (!staticAttributes.has(canonicalOption)) staticAttributes.set(canonicalOption, rule.choice_value);
    return false;
  });

  const grouped = new Map<string, SkuRule[]>();
  nonStaticRules.forEach((rule) => {
    const canonicalOption = mapCsvOptionNameToCanonical(rule.option_name) || rule.option_name;
    const existing = grouped.get(canonicalOption) || [];
    existing.push({ ...rule, option_name: canonicalOption });
    grouped.set(canonicalOption, existing);
  });

  const optionNames = Array.from(grouped.keys()).sort((a, b) => {
    const aDigit = Math.min(...(grouped.get(a) || []).map((r) => r.digit_position));
    const bDigit = Math.min(...(grouped.get(b) || []).map((r) => r.digit_position));
    return aDigit - bDigit;
  });

  let combinations: Array<Record<string, string>> = [{}];
  optionNames.forEach((optionName) => {
    const next: Array<Record<string, string>> = [];
    const values = (grouped.get(optionName) || []).map((rule) => rule.choice_value);
    combinations.forEach((base) => values.forEach((value) => next.push({ ...base, [optionName]: value })));
    combinations = next;
  });

  if (!combinations.length) combinations = [{}];

  return combinations.map((combo) => {
    const chars = Array(30).fill('_');
    nonStaticRules.forEach((rule) => {
      const canonicalOption = mapCsvOptionNameToCanonical(rule.option_name) || rule.option_name;
      if (combo[canonicalOption] === rule.choice_value) chars[rule.digit_position - 1] = rule.code_value;
    });
    chars[16] = normalizeCharacter17(metadata.character17);
    const sku = chars.join('').replace(/_+$/g, '') || '_';

    const row: Record<string, string> = Object.fromEntries(CPQ_COLUMNS.map((column) => [column, '']));
    row.CPQRuleset = metadata.fileName;
    row.ProductLine = metadata.selectedLine;
    row.ProductType = metadata.electricType;
    row['SKU code'] = sku;
    row.Description = metadata.isSpecial && metadata.specialEditionName ? `${metadata.selectedLine} ${metadata.specialEditionName}` : metadata.selectedLine;
    row.ConfigCode = sku;
    row.OptionBox = metadata.isSpecial ? 'Special' : 'Standard';

    for (const [optionName, choiceValue] of staticAttributes.entries()) {
      if (CPQ_COLUMNS.includes(optionName)) row[optionName] = choiceValue;
    }

    Object.entries(combo).forEach(([option, choice]) => {
      if (CPQ_COLUMNS.includes(option)) row[option] = choice;
    });

    row.BikeType = row.BikeType || metadata.selectedLine;

    return row;
  });
}
