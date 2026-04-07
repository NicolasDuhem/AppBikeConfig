import type { SkuRule } from '@/lib/types';

type CpqOptionDefinition = { csv: string; key: string; aliases?: string[] };

type CsvValidationError = {
  rowNumber: number;
  reason: string;
  raw?: Record<string, string>;
};

const EXPECTED_CPQ_HEADERS = ['Option name', 'Description', 'Digit', 'Value'] as const;

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

export type GenerationDiagnostics = {
  activeRowsConsidered: number;
  staticOptionsCount: number;
  digitGroups: Array<{ digitPosition: number; optionName: string; codeValues: string[] }>;
  skippedRows: Array<{ ruleId: number; reason: string; digitPosition: number; codeValue: string; optionName: string }>;
  combinationsProduced: number;
};

export type ParsedCsvRow = {
  rowNumber: number;
  rawOptionName: string;
  optionName: string;
  choiceValue: string;
  digitPosition: number;
  codeValue: string;
};

export type ParsedCpqCsv = {
  rows: ParsedCsvRow[];
  diagnostics: {
    rowsRead: number;
    headerDetected: boolean;
    header: string[];
    delimiter: ',' | '|';
    validationErrors: CsvValidationError[];
  };
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

function normalizeHeaderName(value: string) {
  return String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function parseCells(line: string, delimiter: ',' | '|') {
  return line.split(delimiter).map((cell) => String(cell || '').trim().replace(/^"|"$/g, ''));
}

function detectDelimiter(line: string): ',' | '|' {
  return line.includes('|') ? '|' : ',';
}

function headersMatchExpected(headers: string[]) {
  if (headers.length < 4) return false;
  const normalizedHeaders = headers.slice(0, 4).map(normalizeHeaderName);
  const expected = EXPECTED_CPQ_HEADERS.map(normalizeHeaderName);
  return expected.every((name, index) => normalizedHeaders[index] === name);
}

function looksLikeHeader(headers: string[]) {
  const headerSet = new Set(headers.map(normalizeHeaderName));
  const expectedNames = EXPECTED_CPQ_HEADERS.map(normalizeHeaderName);
  return expectedNames.filter((name) => headerSet.has(name)).length >= 2;
}

export function mapCsvOptionNameToCanonical(value: string) {
  const definition = OPTION_BY_NORMALIZED_NAME.get(normalizeOptionName(value));
  return definition?.csv || null;
}

export function parseSimpleCsv(content: string): ParsedCpqCsv {
  const allLines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!allLines.length) {
    return {
      rows: [],
      diagnostics: { rowsRead: 0, headerDetected: false, header: [], delimiter: ',', validationErrors: [] }
    };
  }

  const delimiter = detectDelimiter(allLines[0]);
  const firstRowCells = parseCells(allLines[0], delimiter);
  const hasHeader = headersMatchExpected(firstRowCells);
  const validationErrors: CsvValidationError[] = [];

  if (!hasHeader && looksLikeHeader(firstRowCells)) {
    validationErrors.push({
      rowNumber: 1,
      reason: `Invalid header row. Expected: ${EXPECTED_CPQ_HEADERS.join(', ')}`,
      raw: {
        optionName: firstRowCells[0] || '',
        description: firstRowCells[1] || '',
        digit: firstRowCells[2] || '',
        value: firstRowCells[3] || ''
      }
    });
  }

  const dataLines = hasHeader ? allLines.slice(1) : allLines;
  const rows: ParsedCsvRow[] = [];

  dataLines.forEach((line, dataIndex) => {
    const cells = parseCells(line, delimiter);
    const rowNumber = (hasHeader ? 2 : 1) + dataIndex;
    const rawOptionName = String(cells[0] || '').trim();
    const canonicalOptionName = mapCsvOptionNameToCanonical(rawOptionName) || rawOptionName;
    const choiceValue = String(cells[1] || '').trim();
    const digitRaw = String(cells[2] || '').trim();
    const digitPosition = Number(digitRaw);
    const codeValue = String(cells[3] || '').trim().toUpperCase();

    if (!Number.isFinite(digitPosition) || Number.isNaN(digitPosition)) {
      validationErrors.push({
        rowNumber,
        reason: `Digit must be a number. Received "${digitRaw}"`,
        raw: { optionName: rawOptionName, description: choiceValue, digit: digitRaw, value: codeValue }
      });
      return;
    }

    rows.push({ rowNumber, rawOptionName, optionName: canonicalOptionName, choiceValue, digitPosition, codeValue });
  });

  return {
    rows,
    diagnostics: {
      rowsRead: rows.length,
      headerDetected: hasHeader,
      header: firstRowCells.slice(0, 4).map((cell) => cell.trim()),
      delimiter,
      validationErrors
    }
  };
}

export function buildCpqCombinationsDetailed(rules: SkuRule[], metadata: CpqMetadata): { rows: Array<Record<string, string>>; diagnostics: GenerationDiagnostics } {
  const diagnostics: GenerationDiagnostics = {
    activeRowsConsidered: rules.length,
    staticOptionsCount: 0,
    digitGroups: [],
    skippedRows: [],
    combinationsProduced: 0
  };

  const latestByStructuralKey = new Map<string, SkuRule>();
  for (const rule of rules) {
    const canonicalOption = mapCsvOptionNameToCanonical(rule.option_name) || rule.option_name;
    const structuralKey = Number(rule.digit_position) === 0
      ? `0|${canonicalOption.toLowerCase()}|${String(rule.code_value || '-').toUpperCase()}`
      : `${Number(rule.digit_position)}|${String(rule.code_value || '').toUpperCase()}`;
    const current = latestByStructuralKey.get(structuralKey);
    if (!current || Number(rule.id) > Number(current.id)) {
      latestByStructuralKey.set(structuralKey, { ...rule, option_name: canonicalOption });
    }
  }

  const normalizedRules = Array.from(latestByStructuralKey.values()).sort((a, b) => Number(a.digit_position) - Number(b.digit_position) || Number(a.id) - Number(b.id));
  const staticAttributes = new Map<string, string>();
  const nonStaticRules = normalizedRules.filter((rule) => {
    if (Number(rule.digit_position) !== 0) return true;
    const canonicalOption = mapCsvOptionNameToCanonical(rule.option_name) || rule.option_name;
    if (!staticAttributes.has(canonicalOption)) staticAttributes.set(canonicalOption, rule.choice_value);
    return false;
  });
  diagnostics.staticOptionsCount = staticAttributes.size;

  const grouped = new Map<number, SkuRule[]>();
  nonStaticRules.forEach((rule) => {
    const digit = Number(rule.digit_position);
    const existing = grouped.get(digit) || [];
    const duplicateCode = existing.find((row) => String(row.code_value).toUpperCase() === String(rule.code_value).toUpperCase());
    if (duplicateCode) {
      diagnostics.skippedRows.push({
        ruleId: Number(rule.id),
        reason: 'duplicate_digit_code_in_scope',
        digitPosition: digit,
        codeValue: String(rule.code_value || '').toUpperCase(),
        optionName: rule.option_name
      });
      return;
    }
    existing.push(rule);
    grouped.set(digit, existing);
  });

  const digits = Array.from(grouped.keys()).sort((a, b) => a - b);
  diagnostics.digitGroups = digits.map((digitPosition) => {
    const rowsForDigit = grouped.get(digitPosition) || [];
    return {
      digitPosition,
      optionName: rowsForDigit[0]?.option_name || '',
      codeValues: rowsForDigit.map((row) => String(row.code_value || '').toUpperCase()).sort()
    };
  });

  let combinations: Array<{ byOption: Record<string, string>; byDigitCode: Record<number, string> }> = [{ byOption: {}, byDigitCode: {} }];
  digits.forEach((digit) => {
    const next: Array<{ byOption: Record<string, string>; byDigitCode: Record<number, string> }> = [];
    const rowsForDigit = grouped.get(digit) || [];
    if (!rowsForDigit.length) {
      diagnostics.skippedRows.push({
        ruleId: 0,
        reason: 'digit_group_missing_rows',
        digitPosition: digit,
        codeValue: '',
        optionName: ''
      });
      return;
    }
    combinations.forEach((base) => rowsForDigit.forEach((rule) => {
      const optionName = mapCsvOptionNameToCanonical(rule.option_name) || rule.option_name;
      next.push({
        byOption: { ...base.byOption, [optionName]: rule.choice_value },
        byDigitCode: { ...base.byDigitCode, [digit]: String(rule.code_value || '').toUpperCase() }
      });
    }));
    combinations = next;
  });

  if (!combinations.length) combinations = [{ byOption: {}, byDigitCode: {} }];

  const rows = combinations.map((combo) => {
    const chars = Array(30).fill('_');
    Object.entries(combo.byDigitCode).forEach(([digit, code]) => {
      const digitPosition = Number(digit);
      if (digitPosition > 0) chars[digitPosition - 1] = code;
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

    Object.entries(combo.byOption).forEach(([option, choice]) => {
      if (CPQ_COLUMNS.includes(option)) row[option] = choice;
    });

    row.BikeType = row.BikeType || metadata.selectedLine;

    return row;
  });
  diagnostics.combinationsProduced = rows.length;
  return { rows, diagnostics };
}

export function buildCpqCombinations(rules: SkuRule[], metadata: CpqMetadata) {
  return buildCpqCombinationsDetailed(rules, metadata).rows;
}
