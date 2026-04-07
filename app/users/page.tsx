'use client';

import { useEffect, useState } from 'react';
import AdminPageShell from '@/components/admin/admin-page-shell';

type AppUserRow = { id: number; email: string; is_active: boolean; roles: string[] };
type Role = { id: number; role_key: string; role_name: string };

function UserRolesEditor({ user, roles, onSave }: { user: AppUserRow; roles: Role[]; onSave: (roleKeys: string[]) => Promise<void> }) {
  const [currentRoles, setCurrentRoles] = useState<string[]>(user.roles || []);

  useEffect(() => {
    setCurrentRoles(user.roles || []);
  }, [user.roles]);

  return (
    <>
      {roles.map((role) => {
        const checked = currentRoles.includes(role.role_key);
        return (
          <label key={role.id} style={{ display: 'block' }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                setCurrentRoles((curr) =>
                  e.target.checked ? [...curr, role.role_key] : curr.filter((rk) => rk !== role.role_key)
                );
              }}
            />{' '}
            {role.role_key}
          </label>
        );
      })}
      <button onClick={() => onSave(currentRoles)}>Save roles</button>
    </>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<AppUserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [loaded, setLoaded] = useState(false);
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
    const [usersRes, rolesRes] = await Promise.all([fetch('/api/users'), fetch('/api/roles')]);
    setUsers(await usersRes.json());
    setRoles(await rolesRes.json());
    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, []);

  async function createUser() {
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setForm({ email: '', password: '', role_keys: [] });
    await load();
  }

  async function toggleActive(user: AppUserRow) {
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, is_active: !user.is_active })
    });
    await load();
  }

  async function saveRoles(user: AppUserRow, roleKeys: string[]) {
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, role_keys: roleKeys })
    });
    await load();
  }

  if (!loaded) return <AdminPageShell title="Users" subtitle="Manage AppBikeConfig user access."><div className="note">Loading...</div></AdminPageShell>;
  if (!allowed) return <AdminPageShell title="Users" subtitle="Manage AppBikeConfig user access."><div className="note">Only sys_admin can manage users.</div></AdminPageShell>;

  return (
    <AdminPageShell title="Users" subtitle="Create users, assign roles, and activate/deactivate accounts.">
      <div className="note">Create users, assign roles, and activate/deactivate accounts.</div>

      <div className="card" style={{ marginBottom: 12, display: 'grid', gap: 8 }}>
        <input placeholder="Email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} />
        <input placeholder="Initial password" type="password" value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} />
        <div className="listBox">
          {roles.map((role) => {
            const checked = form.role_keys.includes(role.role_key);
            return (
              <label key={role.id} style={{ display: 'block' }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    setForm((curr) => ({
                      ...curr,
                      role_keys: e.target.checked
                        ? [...curr.role_keys, role.role_key]
                        : curr.role_keys.filter((rk) => rk !== role.role_key)
                    }));
                  }}
                />{' '}
                {role.role_key}
              </label>
            );
          })}
        </div>
        <button className="primary" onClick={createUser}>Create user</button>
      </div>

      <div className="tableWrap">
        <table>
          <thead><tr><th>Email</th><th>Active</th><th>Roles</th><th>Toggle Active</th></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.is_active ? 'Yes' : 'No'}</td>
                <td><UserRolesEditor user={user} roles={roles} onSave={(keys) => saveRoles(user, keys)} /></td>
                <td><button onClick={() => toggleActive(user)}>{user.is_active ? 'Deactivate' : 'Activate'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPageShell>
  );
}
