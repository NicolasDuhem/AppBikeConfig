export const ROLE_KEYS = ['sys_admin', 'sales_admin', 'sales_standard', 'product_admin', 'read_only'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export type ActionKey =
  | 'matrix.view'
  | 'matrix.update.single'
  | 'matrix.update.bulk'
  | 'country.add'
  | 'setup.manage'
  | 'sku.manage'
  | 'sku.delete'
  | 'builder.use'
  | 'builder.push'
  | 'users.manage'
  | 'permissions.manage'
  | 'feature_flags.manage';

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, ActionKey[]> = {
  sys_admin: [
    'matrix.view',
    'matrix.update.single',
    'matrix.update.bulk',
    'country.add',
    'setup.manage',
    'sku.manage',
    'sku.delete',
    'builder.use',
    'builder.push',
    'users.manage',
    'permissions.manage',
    'feature_flags.manage'
  ],
  sales_admin: ['matrix.view', 'matrix.update.single', 'matrix.update.bulk', 'country.add'],
  sales_standard: ['matrix.view', 'matrix.update.single'],
  product_admin: ['matrix.view', 'setup.manage', 'sku.manage', 'sku.delete', 'builder.use', 'builder.push'],
  read_only: ['matrix.view']
};

export function can(permissions: string[], actionKey: ActionKey) {
  return permissions.includes(actionKey);
}

export function getDefaultPermissionsForRoles(roles: string[]) {
  const all = new Set<ActionKey>();
  roles.forEach((role) => {
    if (!ROLE_KEYS.includes(role as RoleKey)) return;
    DEFAULT_ROLE_PERMISSIONS[role as RoleKey].forEach((permission) => all.add(permission));
  });
  return Array.from(all);
}
