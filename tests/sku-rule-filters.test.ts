import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultRuleFilters, filterSkuRules, getRuleActionLabel } from '../lib/sku-rule-filters.ts';

const rules = [
  {
    id: 1,
    digit_position: 1,
    option_name: 'Colour',
    code_value: 'R',
    choice_value: 'Red',
    description_element: 'Paint',
    is_active: true,
    deactivated_at: null,
    deactivation_reason: null
  },
  {
    id: 2,
    digit_position: 2,
    option_name: 'Wheel',
    code_value: 'L',
    choice_value: 'Large',
    description_element: 'Wheel set',
    is_active: false,
    deactivated_at: '2026-03-01',
    deactivation_reason: 'Retired'
  }
] as any;

test('filters combine digit, status and reason', () => {
  const filtered = filterSkuRules(rules, {
    ...defaultRuleFilters,
    digit: '2',
    status: 'inactive',
    reason: 'retired'
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 2);
});

test('active filter excludes inactive rules', () => {
  const filtered = filterSkuRules(rules, {
    ...defaultRuleFilters,
    status: 'active'
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 1);
});

test('action label matches rule state', () => {
  assert.equal(getRuleActionLabel(rules[0]), 'Deactivate');
  assert.equal(getRuleActionLabel(rules[1]), 'Reactivate');
});
