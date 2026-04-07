import test from 'node:test';
import assert from 'node:assert/strict';
import { rowMatchesMultiSelectFilters, toggleColumnVisibility } from '../lib/admin-table-ui.ts';

test('toggleColumnVisibility hides and restores column in default order', () => {
  const all = ['A', 'B', 'C'];
  const hidden = toggleColumnVisibility(all, all, 'B', false);
  assert.deepEqual(hidden, ['A', 'C']);

  const restored = toggleColumnVisibility(hidden, all, 'B', true);
  assert.deepEqual(restored, ['A', 'B', 'C']);
});

test('rowMatchesMultiSelectFilters validates categorical filters', () => {
  const row = { Ruleset: 'EU', Country: 'GB', Status: 'ok' };
  assert.equal(rowMatchesMultiSelectFilters(row, { Ruleset: ['EU'], Country: ['GB', 'DE'] }), true);
  assert.equal(rowMatchesMultiSelectFilters(row, { Ruleset: ['US'] }), false);
  assert.equal(rowMatchesMultiSelectFilters(row, {}), true);
});
