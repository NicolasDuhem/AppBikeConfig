'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Country, MatrixProductColumn, MatrixRow } from '@/lib/types';

const MATRIX_COLUMN_PREFS_KEY = 'matrix.visible-columns.v1';

const productColumns: Array<{ key: MatrixProductColumn; label: string }> = [
  { key: 'sku_code', label: 'SKU' },
  { key: 'handlebar', label: 'Handlebar' },
  { key: 'speed', label: 'Speed' },
  { key: 'rack', label: 'Rack' },
  { key: 'bike_type', label: 'Bike type' },
  { key: 'colour', label: 'Colour' },
  { key: 'light', label: 'Light' },
  { key: 'seatpost_length', label: 'Seatpost' },
  { key: 'saddle', label: 'Saddle' },
  { key: 'description', label: 'Description' }
];

const defaultVisibleProductColumns = new Set<MatrixProductColumn>(productColumns.map((c) => c.key));
const emptyRow = { sku_code: '', handlebar: '', speed: '', rack: '', bike_type: '', colour: '', light: '', seatpost_length: '', saddle: '', description: '' };

type FilterMode = 'contains' | 'equals' | 'blank' | 'not_blank';
type ColumnFilter = { mode: FilterMode; value: string };

type MatrixClientRow = MatrixRow & { _clientKey: string };

function getDistinct(rows: MatrixClientRow[], key: MatrixProductColumn) {
  return Array.from(new Set(rows.map((r) => String(r[key] || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export default function MatrixPage() {
  const [rows, setRows] = useState<MatrixClientRow[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [status, setStatus] = useState('');
  const [newCountry, setNewCountry] = useState({ country: '', region: '' });
  const [permissions, setPermissions] = useState<string[]>([]);
  const [bulkForm, setBulkForm] = useState({ country_id: 0, available: true });
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [visibleProductColumns, setVisibleProductColumns] = useState<Set<MatrixProductColumn>>(defaultVisibleProductColumns);
  const [visibleCountryIds, setVisibleCountryIds] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<Record<string, ColumnFilter>>({});
  const [dirtyKeys, setDirtyKeys] = useState<Record<string, boolean>>({});
  const [saveSummary, setSaveSummary] = useState<string>('');

  async function load() {
    const [res, meRes] = await Promise.all([fetch('/api/matrix'), fetch('/api/me')]);
    const data = await res.json();
    const me = await meRes.json();
    const loadedRows = (data.rows || []).map((row: MatrixRow) => ({ ...row, _clientKey: row.id ? `id-${row.id}` : `new-${crypto.randomUUID()}` }));
    const loadedCountries = data.countries || [];
    setRows(loadedRows);
    setCountries(loadedCountries);
    setPermissions(me.permissions || []);
    setVisibleCountryIds((current) => (current.size ? current : new Set(loadedCountries.map((c: Country) => c.id))));
    setDirtyKeys({});
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MATRIX_COLUMN_PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.product)) {
        setVisibleProductColumns(new Set(parsed.product.filter((key: string) => productColumns.some((c) => c.key === key))));
      }
      if (Array.isArray(parsed.countryIds)) {
        setVisibleCountryIds(new Set(parsed.countryIds.map((n: unknown) => Number(n)).filter((n: number) => n > 0)));
      }
    } catch {
      // ignore invalid local storage values
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(MATRIX_COLUMN_PREFS_KEY, JSON.stringify({ product: Array.from(visibleProductColumns), countryIds: Array.from(visibleCountryIds) }));
  }, [visibleProductColumns, visibleCountryIds]);

  const canSingleUpdate = permissions.includes('matrix.update.single');
  const canAddCountry = permissions.includes('country.add');
  const canBulkUpdate = permissions.includes('matrix.update.bulk');

  function updateRow(rowKey: string, updater: (row: MatrixClientRow) => MatrixClientRow) {
    setRows((all) => all.map((r) => (r._clientKey === rowKey ? updater(r) : r)));
    setDirtyKeys((all) => ({ ...all, [rowKey]: true }));
  }

  async function saveRow(row: MatrixClientRow) {
    if (!canSingleUpdate) return;
    setStatus('Saving...');
    const res = await fetch('/api/matrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: row, availability: row.availability || {} })
    });
    const payload = await res.json().catch(() => ({}));
    setStatus(res.ok ? 'Saved' : payload.error || 'Save failed');
    await load();
  }

  async function saveAllDirtyRows() {
    if (!canSingleUpdate) return;
    const dirtyRows = rows.filter((r) => dirtyKeys[r._clientKey]);
    if (!dirtyRows.length) {
      setSaveSummary('No changed rows to save.');
      return;
    }
    setStatus('Saving all changed rows...');
    const res = await fetch('/api/matrix/save-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: dirtyRows.map((row) => ({ rowKey: row._clientKey, product: row, availability: row.availability })) })
    });
    const data = await res.json();
    const summary = `Save all complete: ${data.succeeded}/${data.attempted} saved${data.failed ? `, ${data.failed} failed` : ''}.`;
    setSaveSummary(data.failed ? `${summary} ${data.failures.map((f: any) => `${f.rowKey}: ${f.reason}`).join(' | ')}` : summary);
    setStatus(data.failed ? 'Save all finished with validation errors' : 'Save all complete');
    await load();
  }

  async function addCountry() {
    if (!canAddCountry) return;
    if (!newCountry.country || !newCountry.region) return;
    await fetch('/api/countries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCountry) });
    setNewCountry({ country: '', region: '' });
    await load();
  }

  function matchesFilter(rawValue: string, filter: ColumnFilter) {
    const value = String(rawValue || '').trim();
    if (filter.mode === 'blank') return !value;
    if (filter.mode === 'not_blank') return !!value;
    if (filter.mode === 'equals') return value.toLowerCase() === filter.value.trim().toLowerCase();
    return value.toLowerCase().includes(filter.value.trim().toLowerCase());
  }

  const filteredRows = useMemo(() => {
    const activeFilters = Object.entries(filters).filter(([, f]) => (f.mode === 'blank' || f.mode === 'not_blank' || f.value.trim()));
    if (!activeFilters.length) return rows;
    return rows.filter((row) => {
      return activeFilters.every(([columnKey, filter]) => {
        if (columnKey.startsWith('country:')) {
          const countryName = columnKey.replace('country:', '');
          const available = row.availability?.[countryName];
          if (filter.mode === 'equals') {
            return filter.value === 'yes' ? !!available : !available;
          }
          return true;
        }
        return matchesFilter(String((row as any)[columnKey] || ''), filter);
      });
    });
  }, [rows, filters]);

  const visibleCountries = countries.filter((c) => visibleCountryIds.has(c.id));
  const impactedRows = filteredRows.filter((r) => r.id > 0).length;

  async function bulkUpdate() {
    if (!canBulkUpdate || !bulkForm.country_id) return;
    setStatus('Bulk updating...');
    const res = await fetch('/api/matrix/bulk-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...bulkForm, product_ids: impactedRows ? filteredRows.filter((r) => r.id > 0).map((r) => r.id) : undefined })
    });
    const data = await res.json();
    setStatus(res.ok ? `Bulk update done (${data.updated} rows)` : data.error || 'Bulk update failed');
    await load();
  }

  function setFilter(column: string, patch: Partial<ColumnFilter>) {
    setFilters((all) => ({ ...all, [column]: { mode: all[column]?.mode || 'contains', value: all[column]?.value || '', ...patch } }));
  }

  return <div className="page">
    <h2>Matrix</h2>
    <div className="note">Main maintenance screen. Bulk update only affects rows currently returned by active filters.</div>
    <div className="toolbar" style={{ flexWrap: 'wrap' }}>
      <button className="primary" disabled={!canSingleUpdate} onClick={() => setRows([{ id: 0, ...emptyRow, availability: {}, _clientKey: `new-${crypto.randomUUID()}` } as MatrixClientRow, ...rows])}>+ Add Row</button>
      <button className="primary" disabled={!canSingleUpdate} onClick={saveAllDirtyRows}>Save all changed rows</button>
      <button onClick={() => setShowColumnsMenu((v) => !v)}>Columns</button>
      <button onClick={() => setFilters({})}>Reset all filters</button>
      <input placeholder="Country" value={newCountry.country} disabled={!canAddCountry} onChange={(e) => setNewCountry((v) => ({ ...v, country: e.target.value }))} />
      <input placeholder="Region" value={newCountry.region} disabled={!canAddCountry} onChange={(e) => setNewCountry((v) => ({ ...v, region: e.target.value }))} />
      <button disabled={!canAddCountry} onClick={addCountry}>+ Add Country</button>
      <span className="subtle">{status}</span>
    </div>

    {saveSummary ? <div className="note" style={{ marginTop: 8 }}>{saveSummary}</div> : null}

    {showColumnsMenu ? <div className="card" style={{ marginTop: 10, marginBottom: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Visible columns</div>
      <div className="toolbar" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="subtle">Product fields</div>
          {productColumns.map((column) => <label key={column.key} style={{ display: 'block' }}>
            <input type="checkbox" checked={visibleProductColumns.has(column.key)} onChange={(e) => setVisibleProductColumns((current) => {
              const next = new Set(current);
              if (e.target.checked) next.add(column.key); else next.delete(column.key);
              return next;
            })} /> {column.label}
          </label>)}
        </div>
        <div>
          <div className="subtle">Country availability</div>
          {countries.map((country) => <label key={country.id} style={{ display: 'block' }}>
            <input type="checkbox" checked={visibleCountryIds.has(country.id)} onChange={(e) => setVisibleCountryIds((current) => {
              const next = new Set(current);
              if (e.target.checked) next.add(country.id); else next.delete(country.id);
              return next;
            })} /> {country.country}
          </label>)}
        </div>
      </div>
    </div> : null}

    {canBulkUpdate ? <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Bulk update matrix availability</div>
      <div className="subtle" style={{ marginBottom: 8 }}>Impacted rows: {impactedRows} ({Object.keys(filters).length ? 'filtered scope' : 'current working set'})</div>
      <div className="toolbar">
        <select value={bulkForm.country_id} onChange={(e) => setBulkForm((v) => ({ ...v, country_id: Number(e.target.value) }))}>
          <option value={0}>Select country</option>
          {countries.map((c) => <option key={c.id} value={c.id}>{c.country} ({c.region})</option>)}
        </select>
        <select value={bulkForm.available ? 'yes' : 'no'} onChange={(e) => setBulkForm((v) => ({ ...v, available: e.target.value === 'yes' }))}>
          <option value="yes">Available</option>
          <option value="no">Unavailable</option>
        </select>
        <button className="primary" onClick={() => {
          if (!impactedRows) return;
          if (confirm(`Apply bulk update to ${impactedRows} row(s)?`)) bulkUpdate();
        }}>Run bulk update</button>
      </div>
    </div> : null}

    <div className="tableWrap"><table>
      <thead><tr>
        <th>Save</th>
        {productColumns.filter((column) => visibleProductColumns.has(column.key)).map((column) => <th key={column.key}>{column.label}</th>)}
        {visibleCountries.map((c) => <th key={c.id}>{c.country}<div className="subtle">{c.region}</div></th>)}
      </tr>
      <tr>
        <th />
        {productColumns.filter((column) => visibleProductColumns.has(column.key)).map((column) => {
          const distinct = getDistinct(rows, column.key);
          const filter = filters[column.key] || { mode: 'contains', value: '' };
          const canDistinct = distinct.length > 0 && distinct.length <= 25;
          return <th key={`filter-${column.key}`}>
            <select value={filter.mode} onChange={(e) => setFilter(column.key, { mode: e.target.value as FilterMode })}>
              <option value="contains">Contains</option>
              <option value="equals">Exact</option>
              <option value="blank">Blank</option>
              <option value="not_blank">Non-blank</option>
            </select>
            {filter.mode === 'contains' || filter.mode === 'equals' ? (
              canDistinct && filter.mode === 'equals'
                ? <select value={filter.value} onChange={(e) => setFilter(column.key, { value: e.target.value })}><option value="">All</option>{distinct.map((v) => <option key={v} value={v}>{v}</option>)}</select>
                : <input placeholder="Filter" value={filter.value} onChange={(e) => setFilter(column.key, { value: e.target.value })} />
            ) : null}
          </th>;
        })}
        {visibleCountries.map((country) => {
          const key = `country:${country.country}`;
          const filter = filters[key] || { mode: 'equals', value: '' };
          return <th key={`filter-country-${country.id}`}>
            <select value={filter.value} onChange={(e) => setFilter(key, { mode: 'equals', value: e.target.value })}>
              <option value="">All</option>
              <option value="yes">Available</option>
              <option value="no">Unavailable</option>
            </select>
          </th>;
        })}
      </tr>
      </thead>
      <tbody>
        {filteredRows.map((row) => <tr key={row._clientKey}>
          <td><button className="primary" disabled={!canSingleUpdate} onClick={() => saveRow(row)}>Save</button></td>
          {productColumns.filter((column) => visibleProductColumns.has(column.key)).map((column) => (
            <td key={`${row._clientKey}-${column.key}`}>
              <input
                value={String(row[column.key] || '')}
                disabled={!canSingleUpdate}
                onChange={(e) => updateRow(row._clientKey, (r) => ({ ...r, [column.key]: e.target.value }))}
              />
            </td>
          ))}
          {visibleCountries.map((c) => {
            const checked = !!row.availability?.[c.country];
            return <td key={`${row._clientKey}-${c.id}`} className={checked ? 'yes' : 'no'}>
              <input type="checkbox" disabled={!canSingleUpdate} checked={checked} onChange={(e) => updateRow(row._clientKey, (r) => ({ ...r, availability: { ...(r.availability || {}), [c.country]: e.target.checked } }))} />
            </td>;
          })}
        </tr>)}
      </tbody>
    </table></div>
  </div>;
}
