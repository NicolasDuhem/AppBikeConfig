import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidCharacter17, normalizeCharacter17, parseSimpleCsv, buildCpqCombinations, mapCsvOptionNameToCanonical } from '../lib/cpq.ts';
import type { SkuRule } from '../lib/types.ts';

test('character 17 validation and normalization', () => {
  assert.equal(normalizeCharacter17(' a '), 'A');
  assert.equal(isValidCharacter17('A'), true);
  assert.equal(isValidCharacter17('7'), true);
  assert.equal(isValidCharacter17('aa'), false);
  assert.equal(isValidCharacter17('*'), false);
});

test('csv parsing canonicalizes CPQ option names with aliases', () => {
  const parsed = parseSimpleCsv('  mudguardsandrack  ,No rack,3,l\nSaddleBag,None,15,0');
  assert.equal(parsed.rows.length, 2);
  assert.deepEqual(parsed.rows[0], { rowNumber: 1, rawOptionName: 'mudguardsandrack', optionName: 'MudguardsAndRack', choiceValue: 'No rack', digitPosition: 3, codeValue: 'L' });
  assert.equal(parsed.rows[1].optionName, 'Saddlebag');
  assert.equal(mapCsvOptionNameToCanonical(' Mudguards And Rack '), 'MudguardsAndRack');
});

test('csv parsing supports and skips header rows with pipe delimiters', () => {
  const parsed = parseSimpleCsv(' Option name | Description | Digit | Value\n ProductAssist | Non Electric | 0 | -\n HandlebarType | S-Type | 1 | S ');
  assert.equal(parsed.diagnostics.headerDetected, true);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].optionName, 'ProductAssist');
  assert.equal(parsed.rows[1].digitPosition, 1);
});

test('csv parser reports invalid header as validation error', () => {
  const parsed = parseSimpleCsv(' Option | Description | Digit | Value\n ProductAssist | Non Electric | 0 | -');
  assert.ok(parsed.diagnostics.validationErrors.length >= 1);
  assert.ok(parsed.diagnostics.validationErrors.some((error) => /Invalid header row/.test(error.reason)));
});

test('digit 0 static CPQ attributes are included in generated rows', () => {
  const rules: SkuRule[] = [
    { id: 1, digit_position: 0, option_name: 'ProductAssist', code_value: '-', choice_value: 'Non Electric', description_element: null, is_active: true, deactivated_at: null, deactivation_reason: null },
    { id: 2, digit_position: 0, option_name: 'ProductFamily', code_value: '-', choice_value: 'Bikes', description_element: null, is_active: true, deactivated_at: null, deactivation_reason: null },
    { id: 3, digit_position: 1, option_name: 'HandlebarType', code_value: 'H', choice_value: 'Mid', description_element: null, is_active: true, deactivated_at: null, deactivation_reason: null },
    { id: 4, digit_position: 2, option_name: 'Speeds', code_value: '4', choice_value: '4 Speeds', description_element: null, is_active: true, deactivated_at: null, deactivation_reason: null }
  ];

  const rows = buildCpqCombinations(rules, {
    selectedLine: 'C Line', electricType: 'Electric', isSpecial: true, specialEditionName: 'SpecialX', character17: 'b', fileName: 'import.csv'
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].ProductAssist, 'Non Electric');
  assert.equal(rows[0].ProductFamily, 'Bikes');
  assert.equal(rows[0].MudguardsAndRack, '');
  assert.equal(rows[0]['SKU code'][16], 'B');
});

test('generation is keyed by digit + code and does not depend on historical description labels', () => {
  const rules: SkuRule[] = [
    { id: 10, digit_position: 3, option_name: 'MudguardsAndRack', code_value: 'R', choice_value: 'Rack', description_element: 'Rack', is_active: true, deactivated_at: null, deactivation_reason: null },
    { id: 11, digit_position: 3, option_name: 'MudguardsAndRack', code_value: 'N', choice_value: 'No rack', description_element: 'No rack', is_active: true, deactivated_at: null, deactivation_reason: null },
    { id: 12, digit_position: 3, option_name: 'MudguardsAndRack', code_value: 'R', choice_value: 'G line Rack', description_element: 'G line Rack', is_active: true, deactivated_at: null, deactivation_reason: null }
  ];

  const rows = buildCpqCombinations(rules, {
    selectedLine: 'G Line', electricType: 'Non electric', isSpecial: false, character17: 'A', fileName: 'ruleset-a.csv'
  });

  assert.equal(rows.length, 2);
  assert.ok(rows.some((row) => row.MudguardsAndRack === 'G line Rack'));
  assert.ok(rows.some((row) => row.MudguardsAndRack === 'No rack'));
  assert.ok(rows.some((row) => row['SKU code'][2] === 'R'));
  assert.ok(rows.some((row) => row['SKU code'][2] === 'N'));
});
