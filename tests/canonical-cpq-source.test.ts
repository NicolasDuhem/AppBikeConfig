import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const skuApi = readFileSync('app/api/sku-rules/route.ts', 'utf8');
const cpqOptionsApi = readFileSync('app/api/cpq/options/route.ts', 'utf8');
const cpqGenerateApi = readFileSync('app/api/cpq/generate/route.ts', 'utf8');
const setupApi = readFileSync('app/api/product-setup/route.ts', 'utf8');
const usersPage = readFileSync('app/users/page.tsx', 'utf8');
const setupPage = readFileSync('app/setup/page.tsx', 'utf8');

test('product SKU definition and generation APIs use canonical cpq_import_rows', () => {
  assert.match(skuApi, /from cpq_import_rows/);
  assert.match(cpqOptionsApi, /from cpq_import_rows/);
  assert.match(cpqGenerateApi, /from cpq_import_rows/);
  assert.match(setupApi, /from cpq_import_rows/);
});

test('active api paths no longer query sku_rules', () => {
  assert.doesNotMatch(skuApi, /\bsku_rules\b/);
  assert.doesNotMatch(cpqOptionsApi, /\bsku_rules\b/);
  assert.doesNotMatch(cpqGenerateApi, /\bsku_rules\b/);
  assert.doesNotMatch(setupApi, /\bsku_rules\b/);
});

test('admin users page exposes role baseline management and setup page has bounded table scroll', () => {
  assert.match(usersPage, /Standard role base/);
  assert.match(usersPage, /\/api\/role-permissions/);
  assert.match(setupPage, /maxHeight: 280/);
});
