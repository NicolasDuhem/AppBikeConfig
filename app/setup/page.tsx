'use client';
import { useEffect, useState } from 'react';
import AdminPageShell from '@/components/admin/admin-page-shell';

type DigitConfig = {
  id?: number;
  digit_position: number;
  option_name: string;
  is_required: boolean;
  selection_mode: 'single' | 'multi';
  is_active: boolean;
};

type DependencyRule = {
  id?: number;
  source_digit_position: number;
  target_digit_position: number;
  rule_type: 'match_code';
  active: boolean;
  sort_order: number;
  notes?: string;
};

export default function SetupPage() {
  const [digitConfigs, setDigitConfigs] = useState<DigitConfig[]>([]);
  const [dependencyRules, setDependencyRules] = useState<DependencyRule[]>([]);
  const [availableDigits, setAvailableDigits] = useState<Array<{ digit_position: number; option_name: string }>>([]);
  const [canManage, setCanManage] = useState(false);
  const [status, setStatus] = useState('');

  async function load() {
    const [setupRes, meRes] = await Promise.all([fetch('/api/product-setup'), fetch('/api/me')]);
    const setup = await setupRes.json();
    setDigitConfigs(setup.digitConfigs || []);
    setDependencyRules(setup.dependencyRules || []);
    setAvailableDigits(setup.availableDigits || []);
    const me = await meRes.json();
    setCanManage((me.permissions || []).includes('setup.manage'));
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!canManage) return;
    const res = await fetch('/api/product-setup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ digitConfigs, dependencyRules })
    });
    const payload = await res.json().catch(() => ({}));
    setStatus(res.ok ? 'Product setup saved.' : payload.error || 'Save failed');
    if (res.ok) await load();
  }

  return <AdminPageShell title="Product - Setup" subtitle="Configure digit option behavior and dependency rules used by Product - Create SKU.">
    <div className="note compactNote">Only users with <code>setup.manage</code> can update this page.</div>

    <div className="card compactCard compactSection">
      <div className="filtersHeader"><strong>Digit option behavior</strong></div>
      <div className="tableWrap" style={{ maxHeight: 280 }}>
        <table>
          <thead><tr><th>Digit</th><th>Option</th><th>Required</th><th>Selection mode</th><th>Active</th></tr></thead>
          <tbody>
            {digitConfigs.map((cfg, idx) => (
              <tr key={`cfg-${cfg.digit_position}`}>
                <td>{cfg.digit_position}</td>
                <td>
                  <input
                    disabled={!canManage}
                    value={cfg.option_name}
                    onChange={(e) => setDigitConfigs((curr) => curr.map((row, i) => i === idx ? { ...row, option_name: e.target.value } : row))}
                  />
                </td>
                <td><input type="checkbox" disabled={!canManage} checked={cfg.is_required} onChange={(e) => setDigitConfigs((curr) => curr.map((row, i) => i === idx ? { ...row, is_required: e.target.checked } : row))} /></td>
                <td>
                  <select disabled={!canManage} value={cfg.selection_mode} onChange={(e) => setDigitConfigs((curr) => curr.map((row, i) => i === idx ? { ...row, selection_mode: e.target.value as 'single' | 'multi' } : row))}>
                    <option value="single">single</option>
                    <option value="multi">multi</option>
                  </select>
                </td>
                <td><input type="checkbox" disabled={!canManage} checked={cfg.is_active} onChange={(e) => setDigitConfigs((curr) => curr.map((row, i) => i === idx ? { ...row, is_active: e.target.checked } : row))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    <div className="card compactCard compactSection">
      <div className="filtersHeader"><strong>Dependency rules (forced match)</strong>
        <button disabled={!canManage} onClick={() => setDependencyRules((curr) => [...curr, { source_digit_position: availableDigits[0]?.digit_position || 1, target_digit_position: availableDigits[1]?.digit_position || 2, rule_type: 'match_code', active: true, sort_order: (curr.at(-1)?.sort_order || 0) + 10, notes: '' }])}>Add rule</button>
      </div>
      <div className="tableWrap" style={{ maxHeight: 280 }}>
        <table>
          <thead><tr><th>Source digit</th><th>Target digit</th><th>Type</th><th>Order</th><th>Active</th><th>Notes</th><th>Remove</th></tr></thead>
          <tbody>
            {dependencyRules.map((rule, idx) => (
              <tr key={`rule-${idx}`}>
                <td>
                  <select disabled={!canManage} value={rule.source_digit_position} onChange={(e) => setDependencyRules((curr) => curr.map((row, i) => i === idx ? { ...row, source_digit_position: Number(e.target.value) } : row))}>
                    {availableDigits.map((digit) => <option key={`src-${digit.digit_position}`} value={digit.digit_position}>{digit.digit_position} - {digit.option_name}</option>)}
                  </select>
                </td>
                <td>
                  <select disabled={!canManage} value={rule.target_digit_position} onChange={(e) => setDependencyRules((curr) => curr.map((row, i) => i === idx ? { ...row, target_digit_position: Number(e.target.value) } : row))}>
                    {availableDigits.map((digit) => <option key={`target-${digit.digit_position}`} value={digit.digit_position}>{digit.digit_position} - {digit.option_name}</option>)}
                  </select>
                </td>
                <td><select disabled><option>match_code</option></select></td>
                <td><input type="number" disabled={!canManage} value={rule.sort_order} onChange={(e) => setDependencyRules((curr) => curr.map((row, i) => i === idx ? { ...row, sort_order: Number(e.target.value) } : row))} /></td>
                <td><input type="checkbox" disabled={!canManage} checked={rule.active} onChange={(e) => setDependencyRules((curr) => curr.map((row, i) => i === idx ? { ...row, active: e.target.checked } : row))} /></td>
                <td><input disabled={!canManage} value={rule.notes || ''} onChange={(e) => setDependencyRules((curr) => curr.map((row, i) => i === idx ? { ...row, notes: e.target.value } : row))} /></td>
                <td><button disabled={!canManage} onClick={() => setDependencyRules((curr) => curr.filter((_, i) => i !== idx))}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    <div className="toolbar compactToolbar">
      <button className="primary" disabled={!canManage} onClick={save}>Save Product - Setup</button>
      <span className="subtle">{status}</span>
    </div>
  </AdminPageShell>;
}
