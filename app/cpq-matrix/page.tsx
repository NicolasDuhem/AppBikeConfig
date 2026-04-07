'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CpqCountry, CpqMatrixRow } from '@/lib/types';
import AdminPageShell from '@/components/admin/admin-page-shell';

type MatrixClientRow = CpqMatrixRow & { _clientKey: string };

type MatrixFilters = {
  sku: string;
  ruleset: string;
  country: string[];
  bc_status: Array<'ok' | 'nok'>;
  fields: Record<string, string>;
};

const FILTER_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'product_assist', label: 'ProductAssist' },
  { key: 'product_family', label: 'ProductFamily' },
  { key: 'product_line', label: 'ProductLine' },
  { key: 'product_model', label: 'ProductModel' },
  { key: 'product_type', label: 'ProductType' },
  { key: 'handlebar_type', label: 'HandlebarType' },
  { key: 'speeds', label: 'Speeds' },
  { key: 'mudguards_and_rack', label: 'MudguardsAndRack' },
  { key: 'territory', label: 'Territory' },
  { key: 'main_frame_colour', label: 'MainFrameColour' },
  { key: 'rear_frame_colour', label: 'RearFrameColour' },
  { key: 'front_carrier_block', label: 'FrontCarrierBlock' },
  { key: 'lighting', label: 'Lighting' },
  { key: 'saddle_height', label: 'SaddleHeight' },
  { key: 'gear_ratio', label: 'GearRatio' },
  { key: 'saddle', label: 'Saddle' },
  { key: 'tyre', label: 'Tyre' },
  { key: 'brakes', label: 'Brakes' },
  { key: 'pedals', label: 'Pedals' },
  { key: 'saddlebag', label: 'Saddlebag' },
  { key: 'suspension', label: 'Suspension' },
  { key: 'bike_type', label: 'BikeType' },
  { key: 'toolkit', label: 'Toolkit' },
  { key: 'saddle_light', label: 'SaddleLight' },
  { key: 'config_code', label: 'ConfigCode' },
  { key: 'option_box', label: 'OptionBox' },
  { key: 'frame_material', label: 'FrameMaterial' },
  { key: 'frame_set', label: 'FrameSet' },
  { key: 'component_colour', label: 'ComponentColour' },
  { key: 'on_bike_accessories', label: 'OnBikeAccessories' },
  { key: 'handlebar_stem_colour', label: 'HandlebarStemColour' },
  { key: 'handlebar_pin_colour', label: 'HandlebarPinColour' },
  { key: 'front_frame_colour', label: 'FrontFrameColour' },
  { key: 'front_fork_colour', label: 'FrontForkColour' }
];

const emptyFilters: MatrixFilters = { sku: '', ruleset: '', country: [], bc_status: [], fields: {} };

function normalizeBcStatus(raw: string): 'ok' | 'nok' | '' {
  const lowered = String(raw || '').trim().toLowerCase();
  if (lowered === 'ok') return 'ok';
  if (lowered === 'nok') return 'nok';
  return '';
}

export default function CpqMatrixPage() {
  const router = useRouter();
  const [rows, setRows] = useState<MatrixClientRow[]>([]);
  const [countries, setCountries] = useState<CpqCountry[]>([]);
  const [rulesets, setRulesets] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [filters, setFilters] = useState<MatrixFilters>(emptyFilters);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [dirtyKeys, setDirtyKeys] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState('');
  const [saveSummary, setSaveSummary] = useState('');
  const [bcSummary, setBcSummary] = useState('');
  const [isCheckingBc, setIsCheckingBc] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [bulkCountryId, setBulkCountryId] = useState(0);

  const canSingleUpdate = permissions.includes('matrix.update.single');
  const canBulkUpdate = permissions.includes('matrix.update.bulk');

  const load = useCallback(async () => {
    const [flagsRes, res, meRes] = await Promise.all([fetch('/api/feature-flags/public'), fetch('/api/cpq-matrix'), fetch('/api/me')]);
    const flags = await flagsRes.json();
    if (!flags.import_csv_cpq) {
      router.replace('/matrix');
      return;
    }

    const data = await res.json();
    const me = await meRes.json();
    const loadedRows = (data.rows || []).map((row: CpqMatrixRow) => ({ ...row, bc_status: normalizeBcStatus(row.bc_status), _clientKey: row.cpq_rule_id ? `id-${row.cpq_rule_id}` : `new-${crypto.randomUUID()}` }));

    setRows(loadedRows);
    setCountries(data.countries || []);
    setRulesets(data.rulesets || []);
    setPermissions(me.permissions || []);
    setSelectedKeys(new Set());
    setDirtyKeys({});
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const skuSearch = filters.sku.trim().toLowerCase();
    const rowStatus = normalizeBcStatus(row.bc_status);
    if (skuSearch && !String(row.sku_code || '').toLowerCase().includes(skuSearch)) return false;
    if (filters.ruleset && String(row.cpq_ruleset || '') !== filters.ruleset) return false;
    if (filters.bc_status.length && !filters.bc_status.includes(rowStatus as 'ok' | 'nok')) return false;
    if (filters.country.length && !filters.country.some((country) => !!row.availability?.[country])) return false;

    for (const [field, value] of Object.entries(filters.fields)) {
      if (!value.trim()) continue;
      if (!String((row as any)[field] || '').toLowerCase().includes(value.trim().toLowerCase())) return false;
    }

    return true;
  }), [rows, filters]);

  const selectedInFiltered = useMemo(() => filteredRows.filter((row) => selectedKeys.has(row._clientKey)), [filteredRows, selectedKeys]);
  const targetRows = selectedInFiltered.length ? selectedInFiltered : filteredRows;

  function toggleMultiFilter(key: 'country' | 'bc_status', value: string) {
    setFilters((current) => {
      const currentValues = current[key] as string[];
      const exists = currentValues.includes(value);
      return { ...current, [key]: exists ? currentValues.filter((item) => item !== value) : [...currentValues, value] } as MatrixFilters;
    });
  }

  function updateRow(rowKey: string, updater: (row: MatrixClientRow) => MatrixClientRow) {
    setRows((all) => all.map((row) => (row._clientKey === rowKey ? updater(row) : row)));
    setDirtyKeys((all) => ({ ...all, [rowKey]: true }));
  }

  function toggleCountryInline(row: MatrixClientRow, country: CpqCountry) {
    const mismatch = row.brake_type !== country.brake_type;
    if (mismatch) return;
    updateRow(row._clientKey, (current) => ({ ...current, availability: { ...(current.availability || {}), [country.country]: !current.availability?.[country.country] } }));
  }

  async function runBulkCountryUpdate(available: boolean) {
    if (!canBulkUpdate || !bulkCountryId) return;
    setStatus('Applying CPQ bulk update...');
    const res = await fetch('/api/cpq-matrix/bulk-update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ country_id: bulkCountryId, available, product_ids: targetRows.map((row) => row.cpq_rule_id).filter(Boolean) }) });
    const data = await res.json().catch(() => ({}));
    setStatus(res.ok ? `Bulk update done (${data.updated} rows, ${data.blocked || 0} blocked by brake mismatch)` : data.error || 'Bulk update failed');
    await load();
  }

  async function checkBcStatus() {
    if (!targetRows.length) return;
    setIsCheckingBc(true);
    const res = await fetch('/api/cpq-matrix/check-bc-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: targetRows.map((row) => ({ cpq_rule_id: row.cpq_rule_id, sku_code: row.sku_code })) }) });
    const data = await res.json().catch(() => ({}));
    const resultBySku = new Map<string, any>((Array.isArray(data.results) ? data.results : []).map((result: any) => [String(result.inputSku || ''), result]));
    setRows((allRows) => allRows.map((row) => {
      const result = resultBySku.get(String(row.sku_code || '').trim());
      if (!result || result.error) return row;
      return { ...row, bc_status: normalizeBcStatus(result.bcStatus) };
    }));
    setBcSummary(data.summary ? `BigCommerce check complete: ${data.summary.checked} checked, ${data.summary.found} found, ${data.summary.notFound} not found.` : data.error || 'BigCommerce check finished with no summary.');
    setIsCheckingBc(false);
  }

  async function saveAllDirtyRows() {
    const dirtyRows = rows.filter((row) => dirtyKeys[row._clientKey]);
    if (!dirtyRows.length) return;
    setIsSaving(true);
    const res = await fetch('/api/cpq-matrix/save-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: dirtyRows.map((row) => ({ rowKey: row._clientKey, product: row, availability: row.availability })) }) });
    const data = await res.json().catch(() => ({}));
    setSaveSummary(`Save complete: ${data.succeeded || 0}/${data.attempted || dirtyRows.length} saved${data.failed ? `, ${data.failed} failed` : ''}.`);
    setIsSaving(false);
    await load();
  }

  return (
    <AdminPageShell title="CPQ Matrix" subtitle="Manage CPQ matrix products, brake-aware country availability, and BigCommerce validation.">
      <div className="note">Business filters are mapped to CPQ attributes (not just visible table columns). Use Reset filters or clear Ruleset to quickly restart.</div>
      <div className="matrixLayout">
        <aside className="matrixFilters">
          <div className="filtersHeader"><strong>Filters</strong><button onClick={() => setFilters(emptyFilters)}>Reset filters</button></div>
          <label className="filterLabel">Ruleset</label>
          <select value={filters.ruleset} onChange={(e) => setFilters((all) => ({ ...all, ruleset: e.target.value }))}>
            <option value="">All Rulesets</option>
            {rulesets.map((ruleset) => <option key={ruleset} value={ruleset}>{ruleset}</option>)}
          </select>
          <label className="filterLabel">SKU code</label>
          <input value={filters.sku} onChange={(e) => setFilters((all) => ({ ...all, sku: e.target.value }))} placeholder="Search SKU" />

          <div className="filterGroup">
            <div className="filterLabel">BC Status</div>
            <div className="choiceList">
              {(['ok', 'nok'] as const).map((statusValue) => <label key={statusValue} className="choiceRow"><input type="checkbox" checked={filters.bc_status.includes(statusValue)} onChange={() => toggleMultiFilter('bc_status', statusValue)} />{statusValue.toUpperCase()}</label>)}
            </div>
          </div>

          <div className="filterGroup">
            <div className="filterLabel">Country</div>
            <div className="choiceList">{countries.map((c) => <label key={c.country} className="choiceRow"><input type="checkbox" checked={filters.country.includes(c.country)} onChange={() => toggleMultiFilter('country', c.country)} />{c.country}</label>)}</div>
          </div>

          <details open>
            <summary className="filterLabel">CPQ attribute filters</summary>
            <div className="choiceList">
              {FILTER_FIELDS.map((field) => (
                <label key={field.key} className="filterLabel">
                  {field.label}
                  <input
                    value={filters.fields[field.key] || ''}
                    onChange={(e) => setFilters((all) => ({ ...all, fields: { ...all.fields, [field.key]: e.target.value } }))}
                    placeholder={`Filter ${field.label}`}
                  />
                </label>
              ))}
            </div>
          </details>
        </aside>
        <section>
          <div className="toolbar">
            <button className="primary" disabled={!canSingleUpdate || isSaving} onClick={saveAllDirtyRows}>Save changes</button>
            <button disabled={!canBulkUpdate || !bulkCountryId || !targetRows.length} onClick={() => runBulkCountryUpdate(true)}>Assign country</button>
            <button disabled={!canBulkUpdate || !bulkCountryId || !targetRows.length} onClick={() => runBulkCountryUpdate(false)}>Remove country</button>
            <select value={bulkCountryId} onChange={(e) => setBulkCountryId(Number(e.target.value))}><option value={0}>Bulk country</option>{countries.map((country) => <option key={country.id} value={country.id}>{country.country} ({country.region})</option>)}</select>
            <button className="primary" disabled={isCheckingBc || !targetRows.length} onClick={checkBcStatus}>{isCheckingBc ? 'Checking BC…' : 'Check BC status'}</button>
            <span className="subtle">{status}</span>
          </div>
          {bcSummary ? <div className="note">{bcSummary}</div> : null}
          {saveSummary ? <div className="note">{saveSummary}</div> : null}
          <div className="tableWrap">
            <table className="matrixTableSlim">
              <thead><tr><th>Pick</th><th>Ruleset</th><th>SKU</th><th>ProductLine</th><th>HandlebarType</th><th>Speeds</th><th>MudguardsAndRack</th><th>Brake</th><th>Description</th><th>BC Status</th><th>Countries</th></tr></thead>
              <tbody>
                {filteredRows.map((row) => {
                  const bcStatus = normalizeBcStatus(row.bc_status);
                  return <tr key={row._clientKey}>
                    <td><input type="checkbox" checked={selectedKeys.has(row._clientKey)} onChange={(e) => setSelectedKeys((all) => { const next = new Set(all); if (e.target.checked) next.add(row._clientKey); else next.delete(row._clientKey); return next; })} /></td>
                    <td>{row.cpq_ruleset}</td>
                    <td><input value={String(row.sku_code || '')} disabled={!canSingleUpdate} onChange={(e) => updateRow(row._clientKey, (current) => ({ ...current, sku_code: e.target.value }))} /></td>
                    <td>{(row as any).product_line || row.bike_type || '-'}</td>
                    <td>{(row as any).handlebar_type || row.handlebar || '-'}</td>
                    <td>{(row as any).speeds || row.speed || '-'}</td>
                    <td>{(row as any).mudguards_and_rack || row.rack || '-'}</td>
                    <td>{row.brake_type === 'reverse' ? 'Reverse' : 'Non-reverse'}</td>
                    <td>{row.description || <span className="subtle">No description</span>}</td>
                    <td><span className={`statusPill ${bcStatus === 'ok' ? 'ok' : 'nok'}`}>{bcStatus ? bcStatus.toUpperCase() : 'NOK'}</span></td>
                    <td><div className="countryBadges">{countries.map((country) => {
                      const available = !!row.availability?.[country.country];
                      const mismatch = row.brake_type !== country.brake_type;
                      return <button key={`${row._clientKey}-${country.id}`} className={`countryBadge ${mismatch ? 'countryBlocked' : available ? 'countryOn' : 'countryOff'}`} disabled={!canSingleUpdate || mismatch} onClick={() => toggleCountryInline(row, country)} title={mismatch ? `Blocked: ${country.country} is ${country.brake_type}` : `${country.country} (${country.region})`}>{country.country}</button>;
                    })}</div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}
