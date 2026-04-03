export const ROLE_KEYS = ['sys_admin', 'sales_admin', 'sales_standard', 'product_admin', 'read_only'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export type ActionKey =
  | 'matrix.view'
  | 'matrix.update.single'
  | 'matrix.update.bulk'
  | 'country.add'
  | 'setup.manage'
  | 'sku.manage'
  | 'builder.use'
  | 'builder.push'
  | 'users.manage';

const rolePermissions: Record<RoleKey, ActionKey[]> = {
  sys_admin: [
    'matrix.view',
    'matrix.update.single',
    'matrix.update.bulk',
    'country.add',
    'setup.manage',
    'sku.manage',
    'builder.use',
    'builder.push',
    'users.manage'
  ],
  sales_admin: ['matrix.view', 'matrix.update.single', 'matrix.update.bulk', 'country.add'],
  sales_standard: ['matrix.view', 'matrix.update.single'],
  product_admin: ['matrix.view', 'setup.manage', 'sku.manage', 'builder.use', 'builder.push'],
  read_only: ['matrix.view']
};

export function can(roles: string[], actionKey: ActionKey) {
  return roles.some((role) => {
    if (!ROLE_KEYS.includes(role as RoleKey)) return false;
    return rolePermissions[role as RoleKey].includes(actionKey);
  });
}

export function getPermissions(roles: string[]) {
  const all = new Set<ActionKey>();
  roles.forEach((role) => {
    if (!ROLE_KEYS.includes(role as RoleKey)) return;
    rolePermissions[role as RoleKey].forEach((permission) => all.add(permission));
  });
  return Array.from(all);
}
