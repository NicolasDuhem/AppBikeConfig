'use client';
import { useEffect, useMemo, useState } from 'react';
import type { SkuRule } from '@/lib/types';
import AdminPageShell from '@/components/admin/admin-page-shell';

type GeneratedRow = {
  key: string;
  sku_code: string;
  handlebar: string;
  speed: string;
  rack: string;
  bike_type: string;
  colour: string;
  light: string;
  seatpost_length: string;
  saddle: string;
  description: string;
};

const mapping: Record<string, keyof GeneratedRow | 'ignore'> = {
  Handlebar: 'handlebar',
  'Handlebar Type': 'handlebar',
  Speed: 'speed',
  Speeds: 'speed',
  Rack: 'rack',
  'Mudguards and Rack': 'rack',
  'Bike type': 'bike_type',
  'Bike Type': 'bike_type',
  'Main Frame Colour': 'colour',
  Colour: 'colour',
  Lighting: 'light',
  Light: 'light',
  'Saddle Height': 'seatpost_length',
  'Seatpost length': 'seatpost_length',
  Saddle: 'saddle',
  Tyre: 'ignore'
};

export default function BikeBuilderPage() {
  const [rules, setRules] = useState<SkuRule[]>([]);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [generated, setGenerated] = useState<GeneratedRow[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([fetch('/api/sku-rules').then((r) => r.json()), fetch('/api/me').then((r) => r.json())]).then(([rulesData, me]) => {
      setRules((rulesData.rows || []) as SkuRule[]);
      setPermissions(me.permissions || []);
    });
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, SkuRule[]> = {};
    rules.forEach((rule) => {
      map[rule.option_name] ||= [];
      map[rule.option_name].push(rule);
    });
    return map;
  }, [rules]);

  function buildSku(selection: Record<string, string>) {
    const chars = Array(30).fill('_');
    rules.forEach((rule) => {
      if (selection[rule.option_name] === rule.choice_value) chars[rule.digit_position - 1] = rule.code_value;
    });
    return chars.join('').replace(/_+$/g, '') || '_';
  }

  function generate() {
    const optionNames = Object.keys(grouped);
    let rows: Record<string, string>[] = [{}];
    optionNames.forEach((optionName) => {
      const values = (selected[optionName] || []).length ? selected[optionName] : [''];
      const next: Record<string, string>[] = [];
      rows.forEach((row) => values.forEach((value) => next.push({ ...row, [optionName]: value })));
      rows = next;
    });
    const result: GeneratedRow[] = rows.map((row) => {
      const output: GeneratedRow = { key: '', sku_code: buildSku(row), handlebar: '', speed: '', rack: '', bike_type: '', colour: '', light: '', seatpost_length: '', saddle: '', description: row['Tyre'] ? `Tyre: ${row['Tyre']}` : '' };
      Object.entries(row).forEach(([optionName, value]) => {
        const target = mapping[optionName];
        if (target && target !== 'ignore') output[target] = value;
      });
      output.key = [output.sku_code, output.handlebar, output.speed, output.rack, output.bike_type, output.colour, output.light, output.seatpost_length, output.saddle, output.description].join('|');
      return output;
    });
    setGenerated(Array.from(new Map(result.map((r) => [r.key, r])).values()));
    setPicked({});
  }

  async function pushSelected() {
    const rows = generated.filter((row) => picked[row.key]);
    if (!rows.length) return;
    await fetch('/api/builder-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) });
    alert(`${rows.length} row(s) pushed to matrix`);
  }

  const canPush = permissions.includes('builder.push');

  return <AdminPageShell title="Bike Builder" subtitle="Legacy builder flow. Hidden when Import CSV CPQ flag is enabled.">
    <div className="note">Only active SKU definition choices are shown in this builder.</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))', gap: 12, marginBottom: 14 }}>
      {Object.entries(grouped).map(([option, optionRules]) => <div key={option} className="card">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{option}</div>
        <div className="listBox">
          {optionRules.map((rule) => {
            const checked = (selected[option] || []).includes(rule.choice_value);
            return <label key={rule.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input type="checkbox" checked={checked} onChange={(e) => setSelected((current) => {
                const currentList = current[option] || [];
                const nextList = e.target.checked ? [...currentList, rule.choice_value] : currentList.filter((v) => v !== rule.choice_value);
                return { ...current, [option]: nextList };
              })} />
              <span>{rule.choice_value} <span className="subtle">({rule.code_value})</span></span>
            </label>;
          })}
        </div>
      </div>)}
    </div>
    <div className="toolbar">
      <button className="primary" onClick={generate}>Generate all potential SKU code</button>
      <button onClick={() => setPicked(Object.fromEntries(generated.map((r) => [r.key, true])))}>Select all</button>
      <button onClick={() => setPicked({})}>Clear selection</button>
      <button className="primary" disabled={!canPush} onClick={pushSelected}>Push to Matrix !</button>
    </div>
    <div className="tableWrap"><table>
      <thead><tr><th>Pick</th><th>SKU</th><th>Bike type</th><th>Handlebar</th><th>Speed</th><th>Rack</th><th>Colour</th><th>Light</th><th>Seatpost</th><th>Saddle</th><th>Description</th></tr></thead>
      <tbody>{generated.map((row) => <tr key={row.key}><td><input type="checkbox" checked={!!picked[row.key]} onChange={(e) => setPicked((v) => ({ ...v, [row.key]: e.target.checked }))} /></td><td>{row.sku_code}</td><td>{row.bike_type}</td><td>{row.handlebar}</td><td>{row.speed}</td><td>{row.rack}</td><td>{row.colour}</td><td>{row.light}</td><td>{row.seatpost_length}</td><td>{row.saddle}</td><td>{row.description}</td></tr>)}</tbody>
    </table></div>
  </AdminPageShell>;
}
