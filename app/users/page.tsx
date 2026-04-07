'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminPageShell from '@/components/admin/admin-page-shell';

type AppUserRow = {
  id: number;
  email: string;
  is_active: boolean;
  roles: string[];
  user_permission_overrides: Array<{ permission_key: string; granted: boolean }>;
};
type Role = { id: number; role_key: string; role_name: string };
type Permission = { id: number; permission_key: string; permission_name: string; description: string };

function PermissionEditor({ user, permissions, onSave }: { user: AppUserRow; permissions: Permission[]; onSave: (overrides: Array<{ permission_key: string; granted: boolean }>) => Promise<void> }) {
  const [overrides, setOverrides] = useState<Record<string, 'inherit' | 'allow' | 'deny'>>({});

  useEffect(() => {
    const next: Record<string, 'inherit' | 'allow' | 'deny'> = {};
    (user.user_permission_overrides || []).forEach((item) => {
      next[item.permission_key] = item.granted ? 'allow' : 'deny';
    });
    setOverrides(next);
  }, [user.user_permission_overrides]);

  return (
    <div className="listBox" style={{ maxHeight: 180 }}>
      {permissions.map((permission) => (
        <label key={`${user.id}-${permission.permission_key}`} style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
          <span>{permission.permission_key}</span>
          <select
            value={overrides[permission.permission_key] || 'inherit'}
            onChange={(e) => setOverrides((curr) => ({ ...curr, [permission.permission_key]: e.target.value as 'inherit' | 'allow' | 'deny' }))}
          >
            <option value="inherit">Inherit role</option>
            <option value="allow">Allow</option>
            <option value="deny">Deny</option>
          </select>
        </label>
      ))}
      <button
        onClick={() => onSave(Object.entries(overrides)
          .filter(([, state]) => state !== 'inherit')
          .map(([permission_key, state]) => ({ permission_key, granted: state === 'allow' })))}
      >
        Save permission overrides
      </button>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<AppUserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({ email: '', password: '', role_keys: [] as string[] });

  async function load() {
    const meRes = await fetch('/api/me');
    const me = await meRes.json();
    const canManage = (me.roles || []).includes('sys_admin');
    setAllowed(canManage);
    if (!canManage) {
      setLoaded(true);
      return;
    }
    const [usersRes, rolesRes, permsRes] = await Promise.all([fetch('/api/users'), fetch('/api/roles'), fetch('/api/permissions')]);
    setUsers(await usersRes.json());
    setRoles(await rolesRes.json());
    setPermissions(await permsRes.json());
    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, []);

  async function createUser() {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setStatus(res.ok ? 'User created.' : 'Create user failed.');
    setForm({ email: '', password: '', role_keys: [] });
    await load();
  }

  async function toggleActive(user: AppUserRow) {
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, is_active: !user.is_active })
    });
    setStatus(res.ok ? 'User activation updated.' : 'Activation update failed.');
    await load();
  }

  async function saveRoles(user: AppUserRow, roleKeys: string[]) {
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, role_keys: roleKeys })
    });
    setStatus(res.ok ? 'Roles updated.' : 'Role update failed.');
    await load();
  }

  async function savePermissionOverrides(user: AppUserRow, overrides: Array<{ permission_key: string; granted: boolean }>) {
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, permission_overrides: overrides })
    });
    setStatus(res.ok ? 'Permission overrides updated.' : 'Permission overrides update failed.');
    await load();
  }

  const roleOptions = useMemo(() => roles.map((role) => role.role_key), [roles]);

  if (!loaded) return <AdminPageShell title="Admin - Users" subtitle="Manage AppBikeConfig user access."><div className="note compactNote">Loading...</div></AdminPageShell>;
  if (!allowed) return <AdminPageShell title="Admin - Users" subtitle="Manage AppBikeConfig user access."><div className="note compactNote">Only sys_admin can manage users and user permissions.</div></AdminPageShell>;

  return (
    <AdminPageShell title="Admin - Users" subtitle="Create users, assign roles, and manage permission overrides (sys_admin only).">
      <div className="note compactNote">Role is baseline; per-user permission overrides can explicitly allow or deny actions.</div>
      <div className="subtle">{status}</div>

      <div className="card compactCard" style={{ marginBottom: 6, display: 'grid', gap: 8 }}>
        <input placeholder="Email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} />
        <input placeholder="Initial password" type="password" value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} />
        <div className="listBox">
          {roleOptions.map((roleKey) => {
            const checked = form.role_keys.includes(roleKey);
            return (
              <label key={roleKey} style={{ display: 'block' }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    setForm((curr) => ({
                      ...curr,
                      role_keys: e.target.checked
                        ? [...curr.role_keys, roleKey]
                        : curr.role_keys.filter((rk) => rk !== roleKey)
                    }));
                  }}
                />{' '}
                {roleKey}
              </label>
            );
          })}
        </div>
        <button className="primary" onClick={createUser}>Create user</button>
      </div>

      <div className="tableWrap tableViewport">
        <table>
          <thead><tr><th>Email</th><th>Active</th><th>Roles</th><th>Permission overrides</th><th>Toggle Active</th></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.is_active ? 'Yes' : 'No'}</td>
                <td>
                  {roleOptions.map((roleKey) => {
                    const checked = (user.roles || []).includes(roleKey);
                    return (
                      <label key={`${user.id}-${roleKey}`} style={{ display: 'block' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked ? [...(user.roles || []), roleKey] : (user.roles || []).filter((rk) => rk !== roleKey);
                            saveRoles(user, next);
                          }}
                        />{' '}
                        {roleKey}
                      </label>
                    );
                  })}
                </td>
                <td><PermissionEditor user={user} permissions={permissions} onSave={(overrides) => savePermissionOverrides(user, overrides)} /></td>
                <td><button onClick={() => toggleActive(user)}>{user.is_active ? 'Deactivate' : 'Activate'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPageShell>
  );
}
