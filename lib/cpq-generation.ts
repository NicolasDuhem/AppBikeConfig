import type { SkuRule } from './types';
import { CPQ_COLUMNS, mapOptionNameToCanonical } from './cpq-normalization';

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

export function normalizeCharacter17(value: string) {
  return String(value || '').trim().toUpperCase();
}

export function isValidCharacter17(value: string) {
  return /^[A-Z0-9]$/.test(normalizeCharacter17(value));
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
    const canonicalOption = mapOptionNameToCanonical(rule.option_name) || rule.option_name;
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
    const canonicalOption = mapOptionNameToCanonical(rule.option_name) || rule.option_name;
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
      const optionName = mapOptionNameToCanonical(rule.option_name) || rule.option_name;
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
