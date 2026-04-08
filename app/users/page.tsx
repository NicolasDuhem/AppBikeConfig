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

function CheckboxList({
  options,
  selected,
  onToggle,
  maxHeight = 180,
  labelMap
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string, checked: boolean) => void;
  maxHeight?: number;
  labelMap?: Record<string, string>;
}) {
  return (
    <div className="listBox compactCheckboxList" style={{ maxHeight }}>
      {options.map((value) => {
        const checked = selected.includes(value);
        return (
          <label key={value} className="checkboxRow">
            <input type="checkbox" checked={checked} onChange={(e) => onToggle(value, e.target.checked)} />
            <span className="emphasis">{value}</span>
            {labelMap?.[value] ? <span className="subtle">{labelMap[value]}</span> : null}
          </label>
        );
      })}
    </div>
  );
}

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
    <div className="listBox" style={{ maxHeight: 220 }}>
      {permissions.map((permission) => (
        <label key={`${user.id}-${permission.permission_key}`} className="permissionOverrideRow">
          <span className="emphasis">{permission.permission_key}</span>
          <select
            value={overrides[permission.permission_key] || 'inherit'}
            onChange={(e) => setOverrides((curr) => ({ ...curr, [permission.permission_key]: e.target.value as 'inherit' | 'allow' | 'deny' }))}
          >
            <option value="inherit">Inherit role baseline</option>
            <option value="allow">Allow</option>
            <option value="deny">Deny</option>
          </select>
          {permission.description ? <span className="subtle">{permission.description}</span> : null}
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
  const [roleBaselines, setRoleBaselines] = useState<Record<string, string[]>>({});
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('');
  const [activeSection, setActiveSection] = useState<'users' | 'roles'>('users');
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

    const [usersRes, rolesRes, permsRes, baselineRes] = await Promise.all([fetch('/api/users'), fetch('/api/roles'), fetch('/api/permissions'), fetch('/api/role-permissions')]);
    setUsers(await usersRes.json());
    setRoles(await rolesRes.json());
    const perms = await permsRes.json();
    setPermissions(perms);

    const baselineRows = await baselineRes.json();
    const grouped: Record<string, string[]> = {};
    (baselineRows || []).forEach((row: any) => {
      grouped[row.role_key] = [...(grouped[row.role_key] || []), row.permission_key];
    });
    setRoleBaselines(grouped);
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
    setStatus(res.ok ? `Roles updated for ${user.email}.` : 'Role update failed.');
    await load();
  }

  async function savePermissionOverrides(user: AppUserRow, overrides: Array<{ permission_key: string; granted: boolean }>) {
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, permission_overrides: overrides })
    });
    setStatus(res.ok ? `Permission overrides updated for ${user.email}.` : 'Permission overrides update failed.');
    await load();
  }

  async function saveRoleBaseline(roleKey: string, permissionKeys: string[]) {
    const res = await fetch('/api/role-permissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_key: roleKey, permission_keys: permissionKeys })
    });
    setStatus(res.ok ? `Role baseline updated for ${roleKey}.` : 'Role baseline update failed.');
    await load();
  }

  const roleOptions = useMemo(() => roles.map((role) => role.role_key), [roles]);
  const roleLabels = useMemo(() => Object.fromEntries(roles.map((role) => [role.role_key, role.role_name])), [roles]);
  const permissionOptions = useMemo(() => permissions.map((permission) => permission.permission_key), [permissions]);

  if (!loaded) return <AdminPageShell title="Admin - Users" subtitle="Manage AppBikeConfig user access."><div className="note compactNote">Loading...</div></AdminPageShell>;
  if (!allowed) return <AdminPageShell title="Admin - Users" subtitle="Manage AppBikeConfig user access."><div className="note compactNote">Only sys_admin can manage users and user permissions.</div></AdminPageShell>;

  return (
    <AdminPageShell title="Admin - Users" subtitle="Manage users and role access baselines (sys_admin only).">
      <div className="note compactNote">Role baseline defines default access. Per-user overrides can explicitly allow or deny actions.</div>
      {status ? <div className="subtle">{status}</div> : null}

      <div className="sectionTabs" role="tablist" aria-label="Admin users sections">
        <button className={activeSection === 'users' ? 'primary' : ''} onClick={() => setActiveSection('users')} role="tab" aria-selected={activeSection === 'users'}>
          Manage Users
        </button>
        <button className={activeSection === 'roles' ? 'primary' : ''} onClick={() => setActiveSection('roles')} role="tab" aria-selected={activeSection === 'roles'}>
          Manage Role Access
        </button>
      </div>

      {activeSection === 'users' ? (
        <div className="usersAdminLayout">
          <div className="card compactCard">
            <div className="filtersHeader"><strong>Create user</strong></div>
            <div className="usersFormGrid">
              <label>
                Email
                <input placeholder="name@company.com" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} />
              </label>
              <label>
                Initial password
                <input placeholder="Initial password" type="password" value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} />
              </label>
            </div>
            <label className="sectionLabel">Assign roles</label>
            <CheckboxList
              options={roleOptions}
              selected={form.role_keys}
              labelMap={roleLabels}
              onToggle={(roleKey, checked) => {
                setForm((curr) => ({
                  ...curr,
                  role_keys: checked ? [...curr.role_keys, roleKey] : curr.role_keys.filter((rk) => rk !== roleKey)
                }));
              }}
              maxHeight={140}
            />
            <button className="primary" onClick={createUser}>Create user</button>
          </div>

          <div className="tableWrap tableViewport">
            <table>
              <thead><tr><th>User</th><th>Status</th><th>Role assignment</th><th>Permission overrides</th><th>Activation</th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="emphasis">{user.email}</div>
                    </td>
                    <td>{user.is_active ? <span className="statusPill ok">Active</span> : <span className="statusPill nok">Inactive</span>}</td>
                    <td>
                      <CheckboxList
                        options={roleOptions}
                        selected={user.roles || []}
                        labelMap={roleLabels}
                        maxHeight={120}
                        onToggle={(roleKey, checked) => {
                          const next = checked ? [...(user.roles || []), roleKey] : (user.roles || []).filter((rk) => rk !== roleKey);
                          saveRoles(user, next);
                        }}
                      />
                    </td>
                    <td>
                      <PermissionEditor user={user} permissions={permissions} onSave={(overrides) => savePermissionOverrides(user, overrides)} />
                    </td>
                    <td><button onClick={() => toggleActive(user)}>{user.is_active ? 'Deactivate' : 'Activate'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="roleAccessGrid">
          <div className="note compactNote" style={{ gridColumn: '1 / -1' }}>
            Standard role base (role → permissions).
          </div>
          {roleOptions.map((roleKey) => (
            <section key={`baseline-${roleKey}`} className="card compactCard">
              <div className="filtersHeader">
                <div>
                  <strong>{roleKey}</strong>
                  {roleLabels[roleKey] ? <div className="subtle">{roleLabels[roleKey]}</div> : null}
                </div>
                <button onClick={() => saveRoleBaseline(roleKey, roleBaselines[roleKey] || [])}>Save baseline</button>
              </div>
              <label className="sectionLabel">Baseline permissions for {roleKey}</label>
              <CheckboxList
                options={permissionOptions}
                selected={roleBaselines[roleKey] || []}
                maxHeight={260}
                onToggle={(permissionKey, checked) => {
                  setRoleBaselines((curr) => ({
                    ...curr,
                    [roleKey]: checked
                      ? [...(curr[roleKey] || []), permissionKey]
                      : (curr[roleKey] || []).filter((key) => key !== permissionKey)
                  }));
                }}
              />
            </section>
          ))}
        </div>
      )}
    </AdminPageShell>
  );
}
