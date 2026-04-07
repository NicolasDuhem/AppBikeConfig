import type { SkuRule } from '@/lib/types';

export const CPQ_OPTION_NAMES = [
  'CPQRuleset','ProductAssist','ProductFamily','ProductLine','ProductModel','ProductType','BrakeReverse','BrakeNonReverse','SKU code','Description','HandlebarType','Speeds','MudguardsandRack','Territory','MainFrameColour','RearFrameColour','FrontCarrierBlock','Lighting','SaddleHeight','GearRatio','Saddle','Tyre','Brakes','Pedals','Saddlebag','Suspension','BikeType','Toolkit','SaddleLight','ConfigCode','OptionBox','FrameMaterial','FrameSet','ComponentColour','OnBikeAccessories','HandlebarStemColour','HandlebarPinColour','FrontFrameColour','FrontForkColour','Position29','Position30'
] as const;

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

export function parseSimpleCsv(content: string) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const rows: ParsedCsvRow[] = [];

  lines.forEach((line, index) => {
    const cols = line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
    const optionName = String(cols[0] || '').trim();
    const choiceValue = String(cols[1] || '').trim();
    const digitPosition = Number(cols[2] || 0);
    const codeValue = String(cols[3] || '').trim().toUpperCase();
    rows.push({ rowNumber: index + 1, optionName, choiceValue, digitPosition, codeValue });
  });

  return rows;
}

export function buildCpqCombinations(rules: SkuRule[], metadata: CpqMetadata) {
  const grouped = new Map<string, SkuRule[]>();
  rules.forEach((rule) => {
    const existing = grouped.get(rule.option_name) || [];
    existing.push(rule);
    grouped.set(rule.option_name, existing);
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

  return combinations.map((combo) => {
    const byOption = new Map<string, SkuRule>((groupedEntries(grouped)).map((entry) => [entry.optionName, entry.rules[0]]));

    const chars = Array(30).fill('_');
    rules.forEach((rule) => {
      if (combo[rule.option_name] === rule.choice_value) chars[rule.digit_position - 1] = rule.code_value;
    });
    chars[16] = normalizeCharacter17(metadata.character17);
    const sku = chars.join('').replace(/_+$/g, '') || '_';

    const row: Record<string, string> = Object.fromEntries(CPQ_COLUMNS.map((column) => [column, '']));
    row['CPQRuleset'] = metadata.fileName;
    row['ProductLine'] = metadata.selectedLine;
    row['ProductType'] = metadata.electricType;
    row['SKU code'] = sku;
    row['Description'] = metadata.isSpecial && metadata.specialEditionName ? `${metadata.selectedLine} ${metadata.specialEditionName}` : metadata.selectedLine;
    row['ConfigCode'] = sku;
    row['OptionBox'] = metadata.isSpecial ? 'Special' : 'Standard';
    row['BikeType'] = combo['BikeType'] || metadata.selectedLine;

    Object.entries(combo).forEach(([option, choice]) => {
      if (CPQ_COLUMNS.includes(option as any)) row[option] = choice;
      const mappedRule = byOption.get(option);
      if (mappedRule && CPQ_COLUMNS.includes(mappedRule.option_name as any)) row[mappedRule.option_name] = choice;
    });

    return row;
  });
}

function groupedEntries(grouped: Map<string, SkuRule[]>) {
  return Array.from(grouped.entries()).map(([optionName, rules]) => ({ optionName, rules }));
}
