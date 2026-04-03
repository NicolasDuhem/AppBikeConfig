'use client';
import { useEffect, useMemo, useState } from 'react';
import type { SkuRule } from '@/lib/types';

export default function SkuDefinitionPage() {
  const [rules, setRules] = useState<SkuRule[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [canManage, setCanManage] = useState(false);
  const [form, setForm] = useState({ digit_position: 1, option_name: '', code_value: '', choice_value: '', description_element: '' });

  async function load() {
    const [rulesRes, meRes] = await Promise.all([fetch('/api/sku-rules'), fetch('/api/me')]);
    setRules(await rulesRes.json());
    const me = await meRes.json();
    setCanManage((me.permissions || []).includes('sku.manage'));
  }

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const map: Record<string, SkuRule[]> = {};
    rules.forEach(rule => { map[rule.option_name] ||= []; map[rule.option_name].push(rule); });
    return map;
  }, [rules]);

  const preview = useMemo(() => {
    const chars = Array(30).fill('_');
    rules.forEach(rule => { if (selection[rule.option_name] === rule.choice_value) chars[rule.digit_position - 1] = rule.code_value; });
    return chars.join('');
  }, [rules, selection]);

  async function addRule() {
    if (!canManage) return;
    await fetch('/api/sku-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setForm({ digit_position: 1, option_name: '', code_value: '', choice_value: '', description_element: '' });
    await load();
  }

  return <div className="page">
    <h2>Bike SKU Definition</h2>
    <div className="note">Each digit position has a meaning. If nothing is selected for a position, the app fills it with <strong>_</strong>.</div>

    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Add SKU rule</div>
      <div className="toolbar">
        <input type="number" min={1} placeholder="Digit" disabled={!canManage} value={form.digit_position} onChange={(e) => setForm((v) => ({ ...v, digit_position: Number(e.target.value) }))} />
        <input placeholder="Option name" disabled={!canManage} value={form.option_name} onChange={(e) => setForm((v) => ({ ...v, option_name: e.target.value }))} />
        <input placeholder="Code" disabled={!canManage} value={form.code_value} onChange={(e) => setForm((v) => ({ ...v, code_value: e.target.value }))} />
        <input placeholder="Choice" disabled={!canManage} value={form.choice_value} onChange={(e) => setForm((v) => ({ ...v, choice_value: e.target.value }))} />
        <input placeholder="Description element" disabled={!canManage} value={form.description_element} onChange={(e) => setForm((v) => ({ ...v, description_element: e.target.value }))} />
        <button className="primary" disabled={!canManage} onClick={addRule}>Add rule</button>
      </div>
    </div>

    <div className="grid2">
      <div className="sidebar">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Live preview</div>
        {Object.entries(grouped).map(([option, optionRules]) => <div key={option} style={{ marginBottom: 10 }}>
          <div className="subtle" style={{ marginBottom: 4, color: 'var(--text)', fontWeight: 700 }}>{option}</div>
          <select value={selection[option] || ''} onChange={e => setSelection(v => ({ ...v, [option]: e.target.value }))}>
            <option value="">_</option>
            {optionRules.map(rule => <option key={rule.id} value={rule.choice_value}>{rule.choice_value}</option>)}
          </select>
        </div>)}
        <div className="card" style={{ fontFamily: 'monospace' }}>{preview}</div>
      </div>
      <div className="tableWrap"><table>
        <thead><tr><th>Digit</th><th>Option</th><th>Code</th><th>Choice</th><th>Description element</th></tr></thead>
        <tbody>{rules.map(rule => <tr key={rule.id}><td>{rule.digit_position}</td><td>{rule.option_name}</td><td>{rule.code_value}</td><td>{rule.choice_value}</td><td>{rule.description_element}</td></tr>)}</tbody>
      </table></div>
    </div>
  </div>;
}
