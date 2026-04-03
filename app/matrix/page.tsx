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
  const [permissions, setPermissions] = useState<string[]>([]);
  const [bulkForm, setBulkForm] = useState({ country_id: 0, bike_type: '', available: true });

  async function load() {
    const [res, meRes] = await Promise.all([fetch('/api/matrix'), fetch('/api/me')]);
    const data = await res.json();
    const me = await meRes.json();
    setRows(data.rows || []);
    setCountries(data.countries || []);
    setPermissions(me.permissions || []);
  }
  useEffect(() => { load(); }, []);

  const canSingleUpdate = permissions.includes('matrix.update.single');
  const canAddCountry = permissions.includes('country.add');
  const canBulkUpdate = permissions.includes('matrix.update.bulk');

  async function saveRow(row: any) {
    if (!canSingleUpdate) return;
    setStatus('Saving...');
    const res = await fetch('/api/matrix', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ product: row, availability: row.availability || {} }) });
    setStatus(res.ok ? 'Saved' : 'Save failed');
    await load();
  }

  async function addCountry() {
    if (!canAddCountry) return;
    if (!newCountry.country || !newCountry.region) return;
    await fetch('/api/countries', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newCountry) });
    setNewCountry({ country: '', region: '' });
    await load();
  }

  async function bulkUpdate() {
    if (!canBulkUpdate || !bulkForm.country_id) return;
    setStatus('Bulk updating...');
    const res = await fetch('/api/matrix/bulk-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bulkForm)
    });
    const data = await res.json();
    setStatus(res.ok ? `Bulk update done (${data.updated} rows)` : 'Bulk update failed');
    await load();
  }

  const bikeTypes = Array.from(new Set(rows.map(r => r.bike_type).filter(Boolean))).sort();
  const filteredRows = bikeTypeFilter ? rows.filter(r => r.bike_type === bikeTypeFilter) : rows;

  return <div className="page">
    <h2>Matrix</h2>
    <div className="note">This is the normalized version. Products, countries and availability are stored separately, then joined into the matrix view.</div>
    <div className="toolbar">
      <button className="primary" disabled={!canSingleUpdate} onClick={() => setRows([{ id:0, ...emptyRow, availability:{} } as any, ...rows])}>+ Add Row</button>
      <select value={bikeTypeFilter} onChange={e => setBikeTypeFilter(e.target.value)}>
        <option value="">All bike types</option>
        {bikeTypes.map(bt => <option key={bt} value={bt}>{bt}</option>)}
      </select>
      <input placeholder="Country" value={newCountry.country} disabled={!canAddCountry} onChange={e => setNewCountry(v => ({ ...v, country:e.target.value }))} />
      <input placeholder="Region" value={newCountry.region} disabled={!canAddCountry} onChange={e => setNewCountry(v => ({ ...v, region:e.target.value }))} />
      <button disabled={!canAddCountry} onClick={addCountry}>+ Add Country</button>
      <span className="subtle">{status}</span>
    </div>

    {canBulkUpdate ? <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Bulk update matrix availability</div>
      <div className="toolbar">
        <select value={bulkForm.country_id} onChange={(e) => setBulkForm((v) => ({ ...v, country_id: Number(e.target.value) }))}>
          <option value={0}>Select country</option>
          {countries.map((c) => <option key={c.id} value={c.id}>{c.country} ({c.region})</option>)}
        </select>
        <select value={bulkForm.bike_type} onChange={(e) => setBulkForm((v) => ({ ...v, bike_type: e.target.value }))}>
          <option value="">All bike types</option>
          {bikeTypes.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
        </select>
        <select value={bulkForm.available ? 'yes' : 'no'} onChange={(e) => setBulkForm((v) => ({ ...v, available: e.target.value === 'yes' }))}>
          <option value="yes">Available</option>
          <option value="no">Unavailable</option>
        </select>
        <button className="primary" onClick={bulkUpdate}>Run bulk update</button>
      </div>
    </div> : null}

    <div className="tableWrap"><table>
      <thead><tr>
        <th>Save</th><th>SKU</th><th>Handlebar</th><th>Speed</th><th>Rack</th><th>Bike type</th><th>Colour</th><th>Light</th><th>Seatpost</th><th>Saddle</th><th>Description</th>
        {countries.map(c => <th key={c.id}>{c.country}<div className="subtle">{c.region}</div></th>)}
      </tr></thead>
      <tbody>
        {filteredRows.map((row, idx) => <tr key={row.id || `new-${idx}`}>
          <td><button className="primary" disabled={!canSingleUpdate} onClick={() => saveRow(row)}>Save</button></td>
          <td><input value={row.sku_code || ''} disabled={!canSingleUpdate} onChange={e => setRows(all => all.map(r => r === row ? { ...r, sku_code:e.target.value } : r))} /></td>
          <td><input value={row.handlebar || ''} disabled={!canSingleUpdate} onChange={e => setRows(all => all.map(r => r === row ? { ...r, handlebar:e.target.value } : r))} /></td>
          <td><input value={row.speed || ''} disabled={!canSingleUpdate} onChange={e => setRows(all => all.map(r => r === row ? { ...r, speed:e.target.value } : r))} /></td>
          <td><input value={row.rack || ''} disabled={!canSingleUpdate} onChange={e => setRows(all => all.map(r => r === row ? { ...r, rack:e.target.value } : r))} /></td>
          <td><input value={row.bike_type || ''} disabled={!canSingleUpdate} onChange={e => setRows(all => all.map(r => r === row ? { ...r, bike_type:e.target.value } : r))} /></td>
          <td><input value={row.colour || ''} disabled={!canSingleUpdate} onChange={e => setRows(all => all.map(r => r === row ? { ...r, colour:e.target.value } : r))} /></td>
          <td><input value={row.light || ''} disabled={!canSingleUpdate} onChange={e => setRows(all => all.map(r => r === row ? { ...r, light:e.target.value } : r))} /></td>
          <td><input value={row.seatpost_length || ''} disabled={!canSingleUpdate} onChange={e => setRows(all => all.map(r => r === row ? { ...r, seatpost_length:e.target.value } : r))} /></td>
          <td><input value={row.saddle || ''} disabled={!canSingleUpdate} onChange={e => setRows(all => all.map(r => r === row ? { ...r, saddle:e.target.value } : r))} /></td>
          <td><input value={row.description || ''} disabled={!canSingleUpdate} onChange={e => setRows(all => all.map(r => r === row ? { ...r, description:e.target.value } : r))} /></td>
          {countries.map(c => {
            const checked = !!row.availability?.[c.country];
            return <td key={c.id} className={checked ? 'yes' : 'no'}><input type="checkbox" disabled={!canSingleUpdate} checked={checked} onChange={e => setRows(all => all.map(r => r === row ? { ...r, availability: { ...(r.availability||{}), [c.country]: e.target.checked } } : r))} /></td>;
          })}
        </tr>)}
      </tbody>
    </table></div>
  </div>;
}
