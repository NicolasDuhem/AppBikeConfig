import test from 'node:test';
import assert from 'node:assert/strict';
import { can, getDefaultPermissionsForRoles } from '../lib/rbac.ts';

test('default role permissions include sku.delete for product_admin', () => {
  const permissions = getDefaultPermissionsForRoles(['product_admin']);
  assert.equal(permissions.includes('sku.delete'), true);
  assert.equal(can(permissions, 'sku.delete'), true);
});

test('read_only role does not include setup.manage', () => {
  const permissions = getDefaultPermissionsForRoles(['read_only']);
  assert.equal(can(permissions, 'setup.manage'), false);
});
