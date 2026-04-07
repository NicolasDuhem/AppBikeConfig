import test from 'node:test';
import assert from 'node:assert/strict';
import { brakeTypesMatch, isValidBrakeType } from '../lib/cpq-matrix-utils.ts';

test('brake type validation', () => {
  assert.equal(isValidBrakeType('reverse'), true);
  assert.equal(isValidBrakeType('non_reverse'), true);
  assert.equal(isValidBrakeType('other'), false);
});

test('brake mismatch detection', () => {
  assert.equal(brakeTypesMatch('reverse', 'reverse'), true);
  assert.equal(brakeTypesMatch('non_reverse', 'reverse'), false);
});
