import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCpqAttributeEntries, importRowCacheKey } from '../lib/cpq-product-attributes.ts';

test('buildCpqAttributeEntries maps canonical CPQ options and skips empty values', () => {
  const entries = buildCpqAttributeEntries({
    CPQRuleset: 'run-a.csv',
    ProductLine: 'C Line',
    HandlebarType: 'Mid',
    Speeds: '12',
    MudguardsAndRack: '',
    front_fork_colour: 'black'
  });

  const byOption = new Map(entries.map((entry) => [entry.optionName, entry.value]));
  assert.equal(byOption.get('CPQRuleset'), 'run-a.csv');
  assert.equal(byOption.get('ProductLine'), 'C Line');
  assert.equal(byOption.get('HandlebarType'), 'Mid');
  assert.equal(byOption.get('Speeds'), '12');
  assert.equal(byOption.get('FrontForkColour'), 'black');
  assert.equal(byOption.has('MudguardsAndRack'), false);
});

test('importRowCacheKey normalizes case and whitespace for duplicate reuse', () => {
  assert.equal(importRowCacheKey(' ProductLine ', ' C Line '), importRowCacheKey('productline', 'c line'));
});
