import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidCharacter17, normalizeCharacter17, parseSimpleCsv, buildCpqCombinations } from '../lib/cpq.ts';
import type { SkuRule } from '../lib/types.ts';

test('character 17 validation and normalization', () => {
  assert.equal(normalizeCharacter17(' a '), 'A');
  assert.equal(isValidCharacter17('A'), true);
  assert.equal(isValidCharacter17('7'), true);
  assert.equal(isValidCharacter17('aa'), false);
  assert.equal(isValidCharacter17('*'), false);
});

test('csv parsing maps A-D columns', () => {
  const parsed = parseSimpleCsv('HandlebarType,Mid,1,h\nSpeeds,4,2,4');
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[0], { rowNumber: 1, optionName: 'HandlebarType', choiceValue: 'Mid', digitPosition: 1, codeValue: 'H' });
});

test('generation is deterministic and applies character17', () => {
  const rules: SkuRule[] = [
    { id: 1, digit_position: 1, option_name: 'HandlebarType', code_value: 'H', choice_value: 'Mid', description_element: null, is_active: true, deactivated_at: null, deactivation_reason: null },
    { id: 2, digit_position: 2, option_name: 'Speeds', code_value: '4', choice_value: '4', description_element: null, is_active: true, deactivated_at: null, deactivation_reason: null }
  ];
  const rows = buildCpqCombinations(rules, {
    selectedLine: 'C Line', electricType: 'Electric', isSpecial: true, specialEditionName: 'SpecialX', character17: 'b', fileName: 'import.csv'
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]['CPQRuleset'], 'import.csv');
  assert.equal(rows[0]['ProductLine'], 'C Line');
  assert.equal(rows[0]['SKU code'][16], 'B');
});
