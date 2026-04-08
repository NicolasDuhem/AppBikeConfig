'use client';

/**
 * @deprecated Legacy compatibility UI path.
 * New product UX must target CPQ canonical pages.
 */
import { useEffect, useMemo, useState } from 'react';
import type { MatrixRow, Country } from '@/lib/types';

const fields = ['bike_type', 'handlebar', 'speed', 'rack', 'colour', 'light', 'seatpost_length', 'saddle'] as const;

export default function OrderPage() {
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [country, setCountry] = useState('');
  const [search, setSearch] = useState('');
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [selection, setSelection] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/matrix').then(r => r.json()).then(data => { setRows(data.rows || []); setCountries(data.countries || []); });
  }, []);

  const availableRows = useMemo(() => country ? rows.filter(r => !!r.availability?.[country]) : [], [rows, country]);

  function optionsFor(field: string, index: number) {
    let filtered = availableRows.slice();
    for (let i = 0; i < index; i += 1) {
      const prev = fields[i];
      if (selection[prev]) filtered = filtered.filter((r: any) => r[prev] === selection[prev]);
    }
    const allForCountry = Array.from(new Set(availableRows.map((r: any) => r[field]).filter(Boolean))).sort();
    const available = Array.from(new Set(filtered.map((r: any) => r[field]).filter(Boolean))).sort();
    return { list: showUnavailable && index > 0 ? allForCountry : available, enabled: new Set(available) };
  }

  const finalRows = useMemo(() => {
    let filtered = availableRows.slice();
    for (const field of fields) if (selection[field]) filtered = filtered.filter((r: any) => r[field] === selection[field]);
    if (search) filtered = filtered.filter(r => (r.description || '').toLowerCase().includes(search.toLowerCase()));
    return filtered;
  }, [availableRows, selection, search]);

  return <div className="page">
    <h2>Order</h2>
    <div className="note">Bike type always hides unavailable options. Lower filters can show disabled values to keep positions stable.</div>
    <div className="grid2">
      <div className="sidebar">
        <div className="toolbar">
          <select value={country} onChange={e => { setCountry(e.target.value); setSelection({}); }}>
            <option value="">Select country</option>
            {countries.map(c => <option key={c.id} value={c.country}>{c.country} ({c.region})</option>)}
          </select>
          <button onClick={() => setShowUnavailable(v => !v)}>{showUnavailable ? 'Show unavailable mode' : 'Hide unavailable mode'}</button>
        </div>
        {fields.map((field, idx) => {
          const { list, enabled } = optionsFor(field, idx);
          return <div key={field} className="card" style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>{field.replaceAll('_', ' ')}</div>
            <div className="listBox">
              {list.map(value => {
                const disabled = idx > 0 && showUnavailable && !enabled.has(value);
                const selected = selection[field] === value;
                return <button key={value} disabled={disabled} className={selected ? 'primary' : ''} style={{ display:'block', width:'100%', marginBottom:6, opacity: disabled ? 0.45 : 1 }} onClick={() => {
                  const next = { ...selection };
                  if (selected) { for (let i = idx; i < fields.length; i += 1) delete next[fields[i]]; }
                  else { next[field] = value; for (let i = idx + 1; i < fields.length; i += 1) delete next[fields[i]]; }
                  setSelection(next);
                }}>{value}</button>;
              })}
            </div>
          </div>;
        })}
      </div>
      <div>
        <div className="toolbar"><input placeholder="Search description" value={search} onChange={e => setSearch(e.target.value)} /><span className="subtle">{finalRows.length} product(s)</span></div>
        <div className="tiles">
          {finalRows.map(row => <div className="tile" key={row.id}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>{row.sku_code}</div>
            <div className="kv">
              <div className="k">Bike type</div><div>{row.bike_type}</div>
              <div className="k">Handlebar</div><div>{row.handlebar}</div>
              <div className="k">Speed</div><div>{row.speed}</div>
              <div className="k">Rack</div><div>{row.rack}</div>
              <div className="k">Colour</div><div>{row.colour}</div>
              <div className="k">Light</div><div>{row.light}</div>
              <div className="k">Seatpost</div><div>{row.seatpost_length}</div>
              <div className="k">Saddle</div><div>{row.saddle}</div>
              <div className="k">Description</div><div>{row.description}</div>
            </div>
          </div>)}
        </div>
      </div>
    </div>
  </div>;
}
