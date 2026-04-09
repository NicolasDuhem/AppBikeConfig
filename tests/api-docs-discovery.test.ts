import test from 'node:test';
import assert from 'node:assert/strict';

import { discoverApiGetDocs } from '../lib/api-docs.ts';

test('discoverApiGetDocs returns active GET routes and excludes internal auth route', async () => {
  const docs = await discoverApiGetDocs();
  const included = docs.filter((doc) => doc.includeInAdminDocs).map((doc) => doc.path);
  const excluded = docs.filter((doc) => !doc.includeInAdminDocs).map((doc) => doc.path);

  assert.ok(included.includes('/api/cpq/options'));
  assert.ok(included.includes('/api/cpq/generate'));
  assert.ok(included.includes('/api/feature-flags/public'));
  assert.ok(excluded.includes('/api/auth/[...nextauth]'));
  assert.ok(!included.includes('/api/auth/[...nextauth]'));

  assert.equal(included.every((path) => path.startsWith('/api/')), true);
});
