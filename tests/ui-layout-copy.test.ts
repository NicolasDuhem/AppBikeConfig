import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const navigation = readFileSync('components/app-navigation.tsx', 'utf8');
const matrixPage = readFileSync('app/cpq-matrix/page.tsx', 'utf8');
const skuPage = readFileSync('app/sku-definition/page.tsx', 'utf8');
const cpqFeaturePage = readFileSync('app/cpq-feature/page-client.tsx', 'utf8');
const usersPage = readFileSync('app/users/page.tsx', 'utf8');
const featureFlagsPage = readFileSync('app/feature-flags/page-client.tsx', 'utf8');
const styles = readFileSync('app/globals.css', 'utf8');

test('navigation labels use new page naming', () => {
  assert.match(navigation, /Sales - SKU vs Country/);
  assert.match(navigation, /Product - SKU definition/);
  assert.match(navigation, /Product - Create SKU/);
  assert.match(navigation, /Admin - Users/);
  assert.match(navigation, /Admin - Feature flag/);
});

test('main pages expose renamed titles', () => {
  assert.match(matrixPage, /title="Sales - SKU vs Country"/);
  assert.match(skuPage, /title="Product - SKU definition"/);
  assert.match(cpqFeaturePage, /title="Product - Create SKU"/);
  assert.match(usersPage, /title="Admin - Users"/);
  assert.match(featureFlagsPage, /title="Admin - Feature flag"/);
});

test('table-first layout keeps scrollable table viewport and filter toggles', () => {
  assert.match(matrixPage, /Show filters/);
  assert.match(cpqFeaturePage, /Show filters/);
  assert.match(matrixPage, /tableWrap matrixTableWrap/);
  assert.match(skuPage, /tableWrap skuTableWrap/);
  assert.match(cpqFeaturePage, /tableWrap cpqFeatureTableWrap/);
  assert.match(styles, /\.adminPage \{[\s\S]*overflow:hidden;/);
  assert.match(styles, /\.tableViewport \{[\s\S]*flex:1;/);
  assert.match(styles, /\.tableWrap \{[\s\S]*overflow:auto;/);
});


test('product create sku page is DB-selection driven', () => {
  assert.match(cpqFeaturePage, /Digit-based options \(1-30\)/);
  assert.match(cpqFeaturePage, /Generate/);
  assert.doesNotMatch(cpqFeaturePage, /Import CSV/);
});
