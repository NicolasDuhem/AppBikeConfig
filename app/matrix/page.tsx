'use client';
import { useEffect, useState } from 'react';
import type { MatrixRow, Country } from '@/lib/types';

const emptyRow = { sku_code:'', handlebar:'', speed:'', rack:'', bike_type:'', colour:'', light:'', seatpost_length:'', saddle:'', description:'' };

export default function MatrixPage() {
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [status, setStatus] = useState('');
  const [newCountry, setNewCountry] = useState({ country: '', region: '' });
  const [bikeTypeFilter, setBikeTypeFilter] = useState('');

  async function load() {
    const res = await fetch('/api/matrix');
    const data = await res.json();
    setRows(data.rows || []);
    setCountries(data.countries || []);
  }
  useEffect(() => { load(); }, []);

  async function saveRow(row: any) {
    setStatus('Saving...');
    const res = await fetch('/api/matrix', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ product: row, availability: row.availability || {} }) });
    setStatus(res.ok ? 'Saved' : 'Save failed');
    await load();
  }

  async function addCountry() {
    if (!newCountry.country || !newCountry.region) return;
    await fetch('/api/countries', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newCountry) });
    setNewCountry({ country: '', region: '' });
    await load();
  }

  const bikeTypes = Array.from(new Set(rows.map(r => r.bike_type).filter(Boolean))).sort();
  const filteredRows = bikeTypeFilter ? rows.filter(r => r.bike_type === bikeTypeFilter) : rows;

  return <div className="page">
    <h2>Matrix</h2>
    <div className="note">This is the normalized version. Products, countries and availability are stored separately, then joined into the matrix view.</div>
    <div className="toolbar">
      <button className="primary" onClick={() => setRows([{ id:0, ...emptyRow, availability:{} } as any, ...rows])}>+ Add Row</button>
      <select value={bikeTypeFilter} onChange={e => setBikeTypeFilter(e.target.value)}>
        <option value="">All bike types</option>
        {bikeTypes.map(bt => <option key={bt} value={bt}>{bt}</option>)}
      </select>
      <input placeholder="Country" value={newCountry.country} onChange={e => setNewCountry(v => ({ ...v, country:e.target.value }))} />
      <input placeholder="Region" value={newCountry.region} onChange={e => setNewCountry(v => ({ ...v, region:e.target.value }))} />
      <button onClick={addCountry}>+ Add Country</button>
      <span className="subtle">{status}</span>
    </div>
    <div className="tableWrap"><table>
      <thead><tr>
        <th>Save</th><th>SKU</th><th>Handlebar</th><th>Speed</th><th>Rack</th><th>Bike type</th><th>Colour</th><th>Light</th><th>Seatpost</th><th>Saddle</th><th>Description</th>
        {countries.map(c => <th key={c.id}>{c.country}<div className="subtle">{c.region}</div></th>)}
      </tr></thead>
      <tbody>
        {filteredRows.map((row, idx) => <tr key={row.id || `new-${idx}`}>
          <td><button className="primary" onClick={() => saveRow(row)}>Save</button></td>
          <td><input value={row.sku_code || ''} onChange={e => setRows(all => all.map(r => r === row ? { ...r, sku_code:e.target.value } : r))} /></td>
          <td><input value={row.handlebar || ''} onChange={e => setRows(all => all.map(r => r === row ? { ...r, handlebar:e.target.value } : r))} /></td>
          <td><input value={row.speed || ''} onChange={e => setRows(all => all.map(r => r === row ? { ...r, speed:e.target.value } : r))} /></td>
          <td><input value={row.rack || ''} onChange={e => setRows(all => all.map(r => r === row ? { ...r, rack:e.target.value } : r))} /></td>
          <td><input value={row.bike_type || ''} onChange={e => setRows(all => all.map(r => r === row ? { ...r, bike_type:e.target.value } : r))} /></td>
          <td><input value={row.colour || ''} onChange={e => setRows(all => all.map(r => r === row ? { ...r, colour:e.target.value } : r))} /></td>
          <td><input value={row.light || ''} onChange={e => setRows(all => all.map(r => r === row ? { ...r, light:e.target.value } : r))} /></td>
          <td><input value={row.seatpost_length || ''} onChange={e => setRows(all => all.map(r => r === row ? { ...r, seatpost_length:e.target.value } : r))} /></td>
          <td><input value={row.saddle || ''} onChange={e => setRows(all => all.map(r => r === row ? { ...r, saddle:e.target.value } : r))} /></td>
          <td><input value={row.description || ''} onChange={e => setRows(all => all.map(r => r === row ? { ...r, description:e.target.value } : r))} /></td>
          {countries.map(c => {
            const checked = !!row.availability?.[c.country];
            return <td key={c.id} className={checked ? 'yes' : 'no'}><input type="checkbox" checked={checked} onChange={e => setRows(all => all.map(r => r === row ? { ...r, availability: { ...(r.availability||{}), [c.country]: e.target.checked } } : r))} /></td>;
          })}
        </tr>)}
      </tbody>
    </table></div>
  </div>;
}
