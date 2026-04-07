'use client';

import { useEffect, useState } from 'react';
import AdminPageShell from '@/components/admin/admin-page-shell';

type FeatureFlagRow = {
  id: number;
  flag_key: string;
  flag_name: string;
  description: string;
  enabled: boolean;
  updated_at: string;
  updated_by_email: string | null;
};

export default function FeatureFlagsClient() {
  const [rows, setRows] = useState<FeatureFlagRow[]>([]);
  const [status, setStatus] = useState('');

  async function load() {
    const res = await fetch('/api/feature-flags');
    const payload = await res.json();
    setRows(payload.rows || []);
  }

  useEffect(() => { load(); }, []);

  async function toggle(row: FeatureFlagRow, enabled: boolean) {
    setStatus('Updating feature flag...');
    const res = await fetch('/api/feature-flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flag_key: row.flag_key, enabled })
    });
    setStatus(res.ok ? 'Feature flag updated.' : 'Failed to update feature flag.');
    await load();
  }

  return (
    <AdminPageShell title="Feature Flags" subtitle="Manage runtime feature rollout safely. Changes are audited with who and when.">
      <div className="note">{status || 'Only sys_admin can view and modify feature flags.'}</div>
      <div className="tableWrap">
        <table>
          <thead>
            <tr><th>Key</th><th>Name</th><th>Description</th><th>Enabled</th><th>Updated at</th><th>Updated by</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.flag_key}</td>
                <td>{row.flag_name}</td>
                <td>{row.description}</td>
                <td>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" checked={row.enabled} onChange={(e) => toggle(row, e.target.checked)} />
                    {row.enabled ? 'Yes' : 'No'}
                  </label>
                </td>
                <td>{row.updated_at ? new Date(row.updated_at).toLocaleString() : '-'}</td>
                <td>{row.updated_by_email || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPageShell>
  );
}
