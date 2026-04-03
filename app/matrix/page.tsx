'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Country, MatrixRow } from '@/lib/types';

type MatrixClientRow = MatrixRow & { _clientKey: string };

type MatrixFilters = {
  sku: string;
  handlebar: string[];
  speed: string[];
  rack: string[];
  bike_type: string[];
  country: string[];
  bc_status: Array<'ok' | 'nok'>;
};

type AddRowForm = {
  sku_code: string;
  handlebar: string;
  speed: string;
  rack: string;
  bike_type: string;
  colour: string;
  light: string;
  seatpost_length: string;
  saddle: string;
  countries: string[];
};

const emptyFilters: MatrixFilters = {
  sku: '',
  handlebar: [],
  speed: [],
  rack: [],
  bike_type: [],
  country: [],
  bc_status: []
};

const emptyAddForm: AddRowForm = {
  sku_code: '',
  handlebar: '',
  speed: '',
  rack: '',
  bike_type: '',
  colour: '',
  light: '',
  seatpost_length: '',
  saddle: '',
  countries: []
};

function normalizeBcStatus(raw: string): 'ok' | 'nok' | '' {
  const lowered = String(raw || '').trim().toLowerCase();
  if (lowered === 'ok') return 'ok';
  if (lowered === 'nok') return 'nok';
  return '';
}

function deriveDescription(row: MatrixClientRow) {
  const parts = [row.bike_type, row.handlebar, row.speed, row.rack, row.colour, row.light, row.seatpost_length, row.saddle]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return parts.join(' · ');
}

export default function MatrixPage() {
  const [rows, setRows] = useState<MatrixClientRow[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [filters, setFilters] = useState<MatrixFilters>(emptyFilters);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [dirtyKeys, setDirtyKeys] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState('');
  const [saveSummary, setSaveSummary] = useState('');
  const [bcSummary, setBcSummary] = useState('');
  const [isCheckingBc, setIsCheckingBc] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addRowForm, setAddRowForm] = useState<AddRowForm>(emptyAddForm);
  const [bulkCountryId, setBulkCountryId] = useState(0);

  const canSingleUpdate = permissions.includes('matrix.update.single');
  const canBulkUpdate = permissions.includes('matrix.update.bulk');

  const load = useCallback(async () => {
    const [res, meRes] = await Promise.all([fetch('/api/matrix'), fetch('/api/me')]);
    const data = await res.json();
    const me = await meRes.json();
    const loadedRows = (data.rows || []).map((row: MatrixRow) => ({
      ...row,
      bc_status: normalizeBcStatus(row.bc_status),
      _clientKey: row.id ? `id-${row.id}` : `new-${crypto.randomUUID()}`
    }));

    setRows(loadedRows);
    setCountries(data.countries || []);
    setPermissions(me.permissions || []);
    setSelectedKeys(new Set());
    setDirtyKeys({});
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setIsFiltering(true);
    const timer = setTimeout(() => setIsFiltering(false), 120);
    return () => clearTimeout(timer);
  }, [filters]);

  const distinctOptions = useMemo(() => {
    const fieldDistinct = (key: 'handlebar' | 'speed' | 'rack' | 'bike_type') =>
      Array.from(new Set(rows.map((row) => String(row[key] || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return {
      handlebar: fieldDistinct('handlebar'),
      speed: fieldDistinct('speed'),
      rack: fieldDistinct('rack'),
      bike_type: fieldDistinct('bike_type')
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const skuSearch = filters.sku.trim().toLowerCase();
    return rows.filter((row) => {
      const rowStatus = normalizeBcStatus(row.bc_status);
      if (skuSearch && !String(row.sku_code || '').toLowerCase().includes(skuSearch)) return false;
      if (filters.handlebar.length && !filters.handlebar.includes(String(row.handlebar || ''))) return false;
      if (filters.speed.length && !filters.speed.includes(String(row.speed || ''))) return false;
      if (filters.rack.length && !filters.rack.includes(String(row.rack || ''))) return false;
      if (filters.bike_type.length && !filters.bike_type.includes(String(row.bike_type || ''))) return false;
      if (filters.bc_status.length && !filters.bc_status.includes(rowStatus as 'ok' | 'nok')) return false;

      if (filters.country.length) {
        const availableCountries = filters.country.filter((country) => !!row.availability?.[country]);
        if (!availableCountries.length) return false;
      }

      return true;
    });
  }, [rows, filters]);

  const selectedInFiltered = useMemo(() => filteredRows.filter((row) => selectedKeys.has(row._clientKey)), [filteredRows, selectedKeys]);
  const selectedCount = selectedInFiltered.length;
  const targetRows = selectedCount ? selectedInFiltered : filteredRows;

  function toggleMultiFilter(key: 'handlebar' | 'speed' | 'rack' | 'bike_type' | 'country' | 'bc_status', value: string) {
    setFilters((current) => {
      const currentValues = current[key] as string[];
      const exists = currentValues.includes(value);
      return {
        ...current,
        [key]: exists ? currentValues.filter((item) => item !== value) : [...currentValues, value]
      } as MatrixFilters;
    });
  }

  function updateRow(rowKey: string, updater: (row: MatrixClientRow) => MatrixClientRow) {
    setRows((all) => all.map((row) => (row._clientKey === rowKey ? updater(row) : row)));
    setDirtyKeys((all) => ({ ...all, [rowKey]: true }));
  }

  function toggleCountryInline(row: MatrixClientRow, country: string) {
    updateRow(row._clientKey, (current) => ({
      ...current,
      availability: { ...(current.availability || {}), [country]: !current.availability?.[country] }
    }));
  }

  function getTargetRowsForActions() {
    return targetRows.filter((row) => row.id > 0);
  }

  async function runBulkCountryUpdate(available: boolean) {
    if (!canBulkUpdate || !bulkCountryId) return;
    const actionRows = getTargetRowsForActions();
    if (!actionRows.length) {
      setStatus('No persisted rows in scope for bulk country update.');
      return;
    }

    setStatus(`Applying ${available ? 'assign' : 'remove'} country to ${actionRows.length} row(s)...`);
    const res = await fetch('/api/matrix/bulk-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country_id: bulkCountryId,
        available,
        product_ids: actionRows.map((row) => row.id)
      })
    });
    const data = await res.json().catch(() => ({}));
    setStatus(res.ok ? `Bulk update done (${data.updated} rows)` : data.error || 'Bulk update failed');
    await load();
  }

  async function checkBcStatus() {
    if (!targetRows.length) {
      setBcSummary('No rows in scope to check.');
      return;
    }

    setIsCheckingBc(true);
    setBcSummary('Checking BigCommerce variant SKUs...');

    const res = await fetch('/api/matrix/check-bc-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: selectedCount ? 'selected_rows' : 'filtered_rows',
        rows: targetRows.map((row) => ({ id: row.id, sku_code: row.sku_code }))
      })
    });

    const data = await res.json().catch(() => ({}));
    const results = Array.isArray(data.results) ? data.results : [];
    const resultBySku = new Map<string, any>(results.map((result: any) => [String(result.inputSku || ''), result]));

    setRows((allRows) => allRows.map((row) => {
      const result = resultBySku.get(String(row.sku_code || '').trim());
      if (!result || result.error) return row;
      return { ...row, bc_status: normalizeBcStatus(result.bcStatus) };
    }));

    if (data.summary) {
      setBcSummary(`BigCommerce check complete: ${data.summary.checked} checked, ${data.summary.found} found, ${data.summary.notFound} not found.`);
    } else {
      setBcSummary(data.error || 'BigCommerce check finished with no summary.');
    }
    setIsCheckingBc(false);
  }

  async function saveAllDirtyRows() {
    if (!canSingleUpdate) return;
    const dirtyRows = rows.filter((row) => dirtyKeys[row._clientKey]);
    if (!dirtyRows.length) {
      setSaveSummary('No changed rows to save.');
      return;
    }

    setIsSaving(true);
    setStatus(`Saving ${dirtyRows.length} changed row(s)...`);

    const res = await fetch('/api/matrix/save-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: dirtyRows.map((row) => ({ rowKey: row._clientKey, product: row, availability: row.availability }))
      })
    });

    const data = await res.json().catch(() => ({}));
    const summary = `Save complete: ${data.succeeded || 0}/${data.attempted || dirtyRows.length} saved${data.failed ? `, ${data.failed} failed` : ''}.`;
    setSaveSummary(summary);
    setStatus(data.failed ? 'Save finished with validation errors' : 'Save complete');
    setIsSaving(false);
    await load();
  }

  function addRowFromModal() {
    if (!addRowForm.sku_code.trim()) {
      setStatus('SKU is required to add a row.');
      return;
    }

    const availability: Record<string, boolean> = {};
    addRowForm.countries.forEach((country) => { availability[country] = true; });

    const newRow: MatrixClientRow = {
      id: 0,
      sku_code: addRowForm.sku_code.trim(),
      handlebar: addRowForm.handlebar,
      speed: addRowForm.speed,
      rack: addRowForm.rack,
      bike_type: addRowForm.bike_type,
      colour: addRowForm.colour,
      light: addRowForm.light,
      seatpost_length: addRowForm.seatpost_length,
      saddle: addRowForm.saddle,
      description: '',
      bc_status: '',
      availability,
      _clientKey: `new-${crypto.randomUUID()}`
    };

    setRows((current) => [newRow, ...current]);
    setDirtyKeys((current) => ({ ...current, [newRow._clientKey]: true }));
    setIsAddModalOpen(false);
    setAddRowForm(emptyAddForm);
  }

  function toggleSelectAllFiltered(checked: boolean) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      filteredRows.forEach((row) => {
        if (checked) next.add(row._clientKey);
        else next.delete(row._clientKey);
      });
      return next;
    });
  }

  return (
    <div className="page">
      <h2>Matrix</h2>
      <div className="note">Bulk actions apply to selected rows. If no rows are selected, they apply to all filtered rows.</div>

      <div className="matrixLayout">
        <aside className="matrixFilters">
          <div className="filtersHeader">
            <strong>Filters</strong>
            <button onClick={() => setFilters(emptyFilters)}>Reset filters</button>
          </div>

          <label className="filterLabel">SKU search</label>
          <input value={filters.sku} onChange={(e) => setFilters((all) => ({ ...all, sku: e.target.value }))} placeholder="Search SKU" />

          {([
            ['handlebar', 'Handlebar', distinctOptions.handlebar],
            ['speed', 'Speed', distinctOptions.speed],
            ['rack', 'Rack', distinctOptions.rack],
            ['bike_type', 'Bike Type', distinctOptions.bike_type],
            ['country', 'Country', countries.map((c) => c.country)]
          ] as const).map(([key, label, items]) => (
            <div key={key} className="filterGroup">
              <div className="filterLabel">{label}</div>
              <div className="choiceList">
                {items.map((item) => (
                  <label key={item} className="choiceRow">
                    <input
                      type="checkbox"
                      checked={(filters[key] as string[]).includes(item)}
                      onChange={() => toggleMultiFilter(key, item)}
                    />
                    {item}
                  </label>
                ))}
                {!items.length ? <div className="subtle">No options</div> : null}
              </div>
            </div>
          ))}

          <div className="filterGroup">
            <div className="filterLabel">BC Status</div>
            <div className="choiceList">
              {(['ok', 'nok'] as const).map((value) => (
                <label key={value} className="choiceRow">
                  <input
                    type="checkbox"
                    checked={filters.bc_status.includes(value)}
                    onChange={() => toggleMultiFilter('bc_status', value)}
                  />
                  {value.toUpperCase()}
                </label>
              ))}
            </div>
          </div>
        </aside>

        <section>
          <div className="toolbar" style={{ justifyContent: 'space-between' }}>
            <div className="toolbar">
              <button className="primary" disabled={!canSingleUpdate} onClick={() => setIsAddModalOpen(true)}>+ Add Row</button>
              <button className="primary" disabled={!canSingleUpdate || isSaving} onClick={saveAllDirtyRows}>Save changes</button>
            </div>
            <span className="subtle">{status}</span>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="toolbar">
              <strong>Bulk actions</strong>
              <span className="subtle">In scope: {targetRows.length} row(s) ({selectedCount ? 'selected' : 'filtered'})</span>
            </div>
            <div className="toolbar">
              <select value={bulkCountryId} onChange={(e) => setBulkCountryId(Number(e.target.value))}>
                <option value={0}>Select country</option>
                {countries.map((country) => <option key={country.id} value={country.id}>{country.country} ({country.region})</option>)}
              </select>
              <button disabled={!canBulkUpdate || !bulkCountryId || !targetRows.length} onClick={() => runBulkCountryUpdate(true)}>Assign country</button>
              <button disabled={!canBulkUpdate || !bulkCountryId || !targetRows.length} onClick={() => runBulkCountryUpdate(false)}>Remove country</button>
              <button className="primary" disabled={isCheckingBc || !targetRows.length} onClick={checkBcStatus}>{isCheckingBc ? 'Checking BC…' : 'Check BC status'}</button>
              <button className="primary" disabled={!canSingleUpdate || isSaving} onClick={saveAllDirtyRows}>Save changes</button>
            </div>
            {bcSummary ? <div className="note" style={{ marginBottom: 0 }}>{bcSummary}</div> : null}
            {saveSummary ? <div className="note" style={{ marginBottom: 0 }}>{saveSummary}</div> : null}
          </div>

          {isFiltering ? <div className="subtle" style={{ marginBottom: 8 }}>Applying filters…</div> : null}

          <div className="tableWrap">
            <table className="matrixTableSlim">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={!!filteredRows.length && filteredRows.every((row) => selectedKeys.has(row._clientKey))}
                      onChange={(e) => toggleSelectAllFiltered(e.target.checked)}
                    />
                  </th>
                  <th>SKU</th>
                  <th>Description</th>
                  <th>BC Status</th>
                  <th>Countries</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const bcStatus = normalizeBcStatus(row.bc_status);
                  return (
                    <tr key={row._clientKey}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(row._clientKey)}
                          onChange={(e) => setSelectedKeys((all) => {
                            const next = new Set(all);
                            if (e.target.checked) next.add(row._clientKey);
                            else next.delete(row._clientKey);
                            return next;
                          })}
                        />
                      </td>
                      <td>
                        <input
                          value={String(row.sku_code || '')}
                          disabled={!canSingleUpdate}
                          onChange={(e) => updateRow(row._clientKey, (current) => ({ ...current, sku_code: e.target.value }))}
                        />
                      </td>
                      <td>{deriveDescription(row) || <span className="subtle">No options set</span>}</td>
                      <td>
                        <span className={`statusPill ${bcStatus === 'ok' ? 'ok' : 'nok'}`}>
                          <span className="statusDot" />
                          {bcStatus ? bcStatus.toUpperCase() : 'NOK'}
                        </span>
                      </td>
                      <td>
                        <div className="countryBadges">
                          {countries.map((country) => {
                            const available = !!row.availability?.[country.country];
                            return (
                              <button
                                key={`${row._clientKey}-${country.id}`}
                                className={`countryBadge ${available ? 'countryOn' : 'countryOff'}`}
                                disabled={!canSingleUpdate}
                                onClick={() => toggleCountryInline(row, country.country)}
                                title={`${country.country} (${country.region})`}
                              >
                                {country.country}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {isAddModalOpen ? (
        <div className="modalBackdrop" onClick={() => setIsAddModalOpen(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <h3>Add Matrix Row</h3>
            <div className="modalGrid">
              <label>SKU<input value={addRowForm.sku_code} onChange={(e) => setAddRowForm((all) => ({ ...all, sku_code: e.target.value }))} /></label>
              <label>Handlebar<input value={addRowForm.handlebar} onChange={(e) => setAddRowForm((all) => ({ ...all, handlebar: e.target.value }))} /></label>
              <label>Speed<input value={addRowForm.speed} onChange={(e) => setAddRowForm((all) => ({ ...all, speed: e.target.value }))} /></label>
              <label>Rack<input value={addRowForm.rack} onChange={(e) => setAddRowForm((all) => ({ ...all, rack: e.target.value }))} /></label>
              <label>Bike Type<input value={addRowForm.bike_type} onChange={(e) => setAddRowForm((all) => ({ ...all, bike_type: e.target.value }))} /></label>
              <label>Colour<input value={addRowForm.colour} onChange={(e) => setAddRowForm((all) => ({ ...all, colour: e.target.value }))} /></label>
              <label>Light<input value={addRowForm.light} onChange={(e) => setAddRowForm((all) => ({ ...all, light: e.target.value }))} /></label>
              <label>Seatpost<input value={addRowForm.seatpost_length} onChange={(e) => setAddRowForm((all) => ({ ...all, seatpost_length: e.target.value }))} /></label>
              <label>Saddle<input value={addRowForm.saddle} onChange={(e) => setAddRowForm((all) => ({ ...all, saddle: e.target.value }))} /></label>
            </div>
            <div className="filterGroup">
              <div className="filterLabel">Countries</div>
              <div className="choiceList">
                {countries.map((country) => (
                  <label className="choiceRow" key={country.id}>
                    <input
                      type="checkbox"
                      checked={addRowForm.countries.includes(country.country)}
                      onChange={() => setAddRowForm((current) => {
                        const exists = current.countries.includes(country.country);
                        return {
                          ...current,
                          countries: exists ? current.countries.filter((entry) => entry !== country.country) : [...current.countries, country.country]
                        };
                      })}
                    />
                    {country.country}
                  </label>
                ))}
              </div>
            </div>
            <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
              <button onClick={() => setIsAddModalOpen(false)}>Cancel</button>
              <button className="primary" onClick={addRowFromModal}>Add row</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
