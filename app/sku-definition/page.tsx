'use client';
import { useEffect, useMemo, useState } from 'react';
import type { SkuDigitIssue, SkuRule } from '@/lib/types';

export default function SkuDefinitionPage() {
  const [rules, setRules] = useState<SkuRule[]>([]);
  const [digitIssues, setDigitIssues] = useState<SkuDigitIssue[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [canManage, setCanManage] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({ digit_position: 1, option_name: '', code_value: '', choice_value: '', description_element: '' });

  async function load(nextFilter = statusFilter) {
    const [rulesRes, meRes] = await Promise.all([
      fetch(`/api/sku-rules${nextFilter === 'active' ? '' : '?include_inactive=1'}`),
      fetch('/api/me')
    ]);
    const payload = await rulesRes.json();
    setRules((payload.rows || []) as SkuRule[]);
    setDigitIssues((payload.digitIssues || []) as SkuDigitIssue[]);
    const me = await meRes.json();
    setCanManage((me.permissions || []).includes('sku.manage'));
  }

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const map: Record<string, SkuRule[]> = {};
    const filteredByStatus = rules.filter((r) => statusFilter === 'all' || (statusFilter === 'active' ? r.is_active : !r.is_active));
    filteredByStatus.forEach((rule) => {
      map[rule.option_name] ||= [];
      map[rule.option_name].push(rule);
    });
    return map;
  }, [rules, statusFilter]);

  const preview = useMemo(() => {
    const chars = Array(30).fill('_');
    rules.filter((r) => r.is_active).forEach((rule) => {
      if (selection[rule.option_name] === rule.choice_value) chars[rule.digit_position - 1] = rule.code_value;
    });
    return chars.join('');
  }, [rules, selection]);

  const knownDigitOptionName = useMemo(() => {
    const row = rules.find((rule) => rule.digit_position === form.digit_position);
    return row?.option_name || '';
  }, [form.digit_position, rules]);

  useEffect(() => {
    if (knownDigitOptionName) {
      setForm((v) => ({ ...v, option_name: knownDigitOptionName }));
    }
  }, [knownDigitOptionName]);

  async function addRule() {
    if (!canManage) return;
    setStatus('Saving...');
    const res = await fetch('/api/sku-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const payload = await res.json().catch(() => ({}));
    setStatus(res.ok ? 'Saved' : payload.error || 'Save failed');
    if (res.ok) {
      setForm({ digit_position: 1, option_name: '', code_value: '', choice_value: '', description_element: '' });
      await load(statusFilter);
    }
  }

  async function toggleActive(rule: SkuRule) {
    if (!canManage) return;
    const nextActive = !rule.is_active;
    const reason = !nextActive ? prompt('Please provide deactivation reason') || '' : '';
    const res = await fetch('/api/sku-rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, is_active: nextActive, deactivation_reason: reason })
    });
    const payload = await res.json().catch(() => ({}));
    setStatus(res.ok ? (nextActive ? 'Rule reactivated' : 'Rule deactivated') : payload.error || 'Update failed');
    if (res.ok) await load(statusFilter);
  }

  const visibleRules = rules.filter((r) => statusFilter === 'all' || (statusFilter === 'active' ? r.is_active : !r.is_active));

  return <div className="page">
    <h2>Bike SKU Definition</h2>
    <div className="note">Digit is structurally tied to one option name across all rows (active + inactive). Codes are case-insensitive and normalized to uppercase.</div>

    {digitIssues.length ? <div className="card" style={{ marginBottom: 12, borderColor: '#b91c1c' }}>
      <div style={{ fontWeight: 700 }}>Data issue found</div>
      <div>Some digits are mapped to multiple option names and need cleanup:</div>
      <ul>{digitIssues.map((issue) => <li key={issue.digit_position}>Digit {issue.digit_position}: {issue.option_names.join(', ')}</li>)}</ul>
    </div> : null}

    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Add SKU rule</div>
      <div className="toolbar">
        <input type="number" min={1} placeholder="Digit" disabled={!canManage} value={form.digit_position} onChange={(e) => setForm((v) => ({ ...v, digit_position: Number(e.target.value) }))} />
        <input placeholder="Option name" disabled={!canManage || !!knownDigitOptionName} value={form.option_name} onChange={(e) => setForm((v) => ({ ...v, option_name: e.target.value }))} />
        <input placeholder="Code" maxLength={1} disabled={!canManage} value={form.code_value} onChange={(e) => setForm((v) => ({ ...v, code_value: e.target.value.toUpperCase() }))} />
        <input placeholder="Choice" disabled={!canManage} value={form.choice_value} onChange={(e) => setForm((v) => ({ ...v, choice_value: e.target.value }))} />
        <input placeholder="Description element" disabled={!canManage} value={form.description_element} onChange={(e) => setForm((v) => ({ ...v, description_element: e.target.value }))} />
        <button className="primary" disabled={!canManage} onClick={addRule}>Add rule</button>
        <span className="subtle">{status}</span>
      </div>
      {knownDigitOptionName ? <div className="subtle">Digit {form.digit_position} already uses option “{knownDigitOptionName}”.</div> : null}
    </div>

    <div className="toolbar" style={{ marginBottom: 12 }}>
      <label>Status filter</label>
      <select value={statusFilter} onChange={(e) => {
        const next = e.target.value as 'all' | 'active' | 'inactive';
        setStatusFilter(next);
        load(next);
      }}>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="all">All</option>
      </select>
    </div>

    <div className="grid2">
      <div className="sidebar">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Live preview (active rules)</div>
        {Object.entries(grouped).filter(([, optionRules]) => optionRules.some((rule) => rule.is_active)).map(([option, optionRules]) => <div key={option} style={{ marginBottom: 10 }}>
          <div className="subtle" style={{ marginBottom: 4, color: 'var(--text)', fontWeight: 700 }}>{option}</div>
          <select value={selection[option] || ''} onChange={(e) => setSelection((v) => ({ ...v, [option]: e.target.value }))}>
            <option value="">_</option>
            {optionRules.filter((r) => r.is_active).map((rule) => <option key={rule.id} value={rule.choice_value}>{rule.choice_value}</option>)}
          </select>
        </div>)}
        <div className="card" style={{ fontFamily: 'monospace' }}>{preview}</div>
      </div>
      <div className="tableWrap"><table>
        <thead><tr><th>Digit</th><th>Option</th><th>Code</th><th>Choice</th><th>Status</th><th>Deactivated at</th><th>Reason</th><th>Action</th></tr></thead>
        <tbody>{visibleRules.map((rule) => <tr key={rule.id}><td>{rule.digit_position}</td><td>{rule.option_name}</td><td>{rule.code_value}</td><td>{rule.choice_value}</td><td>{rule.is_active ? 'Active' : 'Inactive'}</td><td>{rule.deactivated_at || '-'}</td><td>{rule.deactivation_reason || '-'}</td><td><button disabled={!canManage} onClick={() => toggleActive(rule)}>{rule.is_active ? 'Deactivate' : 'Reactivate'}</button></td></tr>)}</tbody>
      </table></div>
    </div>
  </div>;
}
