'use client';
import { useEffect, useState } from 'react';
import type { SetupOption } from '@/lib/types';

export default function SetupPage() {
  const [rows, setRows] = useState<SetupOption[]>([]);
  const [form, setForm] = useState({ option_name: '', choice_value: '', sort_order: 0 });

  async function load() { const res = await fetch('/api/setup-options'); setRows(await res.json()); }
  useEffect(() => { load(); }, []);

  async function add() {
    await fetch('/api/setup-options', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
    setForm({ option_name:'', choice_value:'', sort_order:0 });
    await load();
  }
  async function remove(id: number) { await fetch(`/api/setup-options?id=${id}`, { method:'DELETE' }); await load(); }

  return <div className="page">
    <h2>Setup</h2>
    <div className="note">This is the generic option manager. Handlebar, Speed, Rack, Bike type and other dropdown values should live here.</div>
    <div className="toolbar">
      <input placeholder="Option name" value={form.option_name} onChange={e => setForm(v => ({ ...v, option_name:e.target.value }))} />
      <input placeholder="Choice value" value={form.choice_value} onChange={e => setForm(v => ({ ...v, choice_value:e.target.value }))} />
      <input placeholder="Sort order" type="number" value={form.sort_order} onChange={e => setForm(v => ({ ...v, sort_order:Number(e.target.value) }))} />
      <button className="primary" onClick={add}>Add</button>
    </div>
    <div className="tableWrap"><table>
      <thead><tr><th>Option</th><th>Choice</th><th>Sort order</th><th>Remove</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.id}><td>{r.option_name}</td><td>{r.choice_value}</td><td>{r.sort_order}</td><td><button onClick={() => remove(r.id)}>Remove</button></td></tr>)}</tbody>
    </table></div>
  </div>;
}
