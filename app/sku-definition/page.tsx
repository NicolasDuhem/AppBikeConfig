'use client';
import { useEffect, useMemo, useState } from 'react';
import type { SkuRule } from '@/lib/types';

export default function SkuDefinitionPage() {
  const [rules, setRules] = useState<SkuRule[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  useEffect(() => { fetch('/api/sku-rules').then(r => r.json()).then(setRules); }, []);

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

  return <div className="page">
    <h2>Bike SKU Definition</h2>
    <div className="note">Each digit position has a meaning. If nothing is selected for a position, the app fills it with <strong>_</strong>.</div>
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
