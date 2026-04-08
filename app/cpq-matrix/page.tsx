'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { CpqCountry, CpqMatrixRow } from '@/lib/types';
import AdminPageShell from '@/components/admin/admin-page-shell';
import { canPreviewPicture, canShowPickPictureAction, hasLinkedPicture } from '@/lib/cpq-picture-picker';

type MatrixClientRow = CpqMatrixRow & { _clientKey: string };
type PictureFormState = { asset_url: string; png_url: string; asset_id: string; notes: string };

type MatrixFilters = {
  sku: string;
  ruleset: string[];
  country: string[];
  bc_status: Array<'ok' | 'nok'>;
  fields: Record<string, string[]>;
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

const defaultFilters: MatrixFilters = { sku: '', ruleset: [], country: [], bc_status: [], fields: {} };

function normalizeBcStatus(raw: string): 'ok' | 'nok' | '' {
  const lowered = String(raw || '').trim().toLowerCase();
  if (lowered === 'ok') return 'ok';
  if (lowered === 'nok') return 'nok';
  return '';
}

function selectedValues(event: ChangeEvent<HTMLSelectElement>) {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

function getFieldValue(row: MatrixClientRow, field: string): string {
  return String((row as Record<string, any>)[field] || '').trim();
}

export default function CpqMatrixPage() {
  const [rows, setRows] = useState<MatrixClientRow[]>([]);
  const [countries, setCountries] = useState<CpqCountry[]>([]);
  const [rulesets, setRulesets] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [filters, setFilters] = useState<MatrixFilters>(defaultFilters);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [dirtyKeys, setDirtyKeys] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState('');
  const [saveSummary, setSaveSummary] = useState('');
  const [bcSummary, setBcSummary] = useState('');
  const [isCheckingBc, setIsCheckingBc] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [bulkCountryId, setBulkCountryId] = useState(0);
  const [isPicturePickerEnabled, setIsPicturePickerEnabled] = useState(false);
  const [pictureRow, setPictureRow] = useState<MatrixClientRow | null>(null);
  const [pictureForm, setPictureForm] = useState<PictureFormState>({ asset_url: '', png_url: '', asset_id: '', notes: '' });
  const [pictureStatus, setPictureStatus] = useState('');
  const [iframeError, setIframeError] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const canSingleUpdate = permissions.includes('matrix.update.single');
  const canBulkUpdate = permissions.includes('matrix.update.bulk');

  const filterValueOptions = useMemo(() => {
    return Object.fromEntries(FILTER_FIELDS.map((field) => {
      const options = Array.from(new Set(rows.map((row) => getFieldValue(row, field.key)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
      return [field.key, options];
    }));
  }, [rows]);

  const load = useCallback(async () => {
    const [flagsRes, res, meRes] = await Promise.all([fetch('/api/feature-flags/public'), fetch('/api/cpq-matrix'), fetch('/api/me')]);
    const flags = await flagsRes.json();
    const data = await res.json();
    const me = await meRes.json();
    const loadedRows = (data.rows || []).map((row: CpqMatrixRow) => ({ ...row, bc_status: normalizeBcStatus(row.bc_status), _clientKey: row.cpq_rule_id ? `id-${row.cpq_rule_id}` : `new-${crypto.randomUUID()}` }));

    setRows(loadedRows);
    setCountries(data.countries || []);
    setRulesets(data.rulesets || []);
    setPermissions(me.permissions || []);
    setIsPicturePickerEnabled(!!flags.cpq_bdam_picture_picker);
    setSelectedKeys(new Set());
    setDirtyKeys({});
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const skuSearch = filters.sku.trim().toLowerCase();
    const rowStatus = normalizeBcStatus(row.bc_status);
    if (skuSearch && !String(row.sku_code || '').toLowerCase().includes(skuSearch)) return false;
    if (filters.ruleset.length && !filters.ruleset.includes(String(row.cpq_ruleset || ''))) return false;
    if (filters.bc_status.length && !filters.bc_status.includes(rowStatus as 'ok' | 'nok')) return false;
    if (filters.country.length && !filters.country.some((country) => !!row.availability?.[country])) return false;

    for (const [field, selected] of Object.entries(filters.fields)) {
      if (!selected.length) continue;
      const value = getFieldValue(row, field);
      if (!selected.includes(value)) return false;
    }

    return true;
  }), [rows, filters]);

  const selectedInFiltered = useMemo(() => filteredRows.filter((row) => selectedKeys.has(row._clientKey)), [filteredRows, selectedKeys]);
  const targetRows = selectedInFiltered.length ? selectedInFiltered : filteredRows;

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

  function openPictureModal(row: MatrixClientRow) {
    setPictureRow(row);
    setPictureStatus('');
    setIframeError(false);
    setPictureForm({
      asset_url: String(row.picture_asset_url || ''),
      png_url: String(row.picture_png_url || ''),
      asset_id: String(row.picture_asset_id || ''),
      notes: String(row.picture_notes || '')
    });
  }

  async function savePicture() {
    if (!pictureRow) return;
    setPictureStatus('Saving picture details...');
    const res = await fetch('/api/cpq-matrix/picture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpq_rule_id: pictureRow.cpq_rule_id, ...pictureForm })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPictureStatus(data.error || 'Failed to save picture details.');
      return;
    }
    setPictureStatus('Picture details saved.');
    setPictureRow(null);
    await load();
  }

  const previewUrl = pictureForm.png_url.trim() || pictureForm.asset_url.trim();
  const previewEnabled = canPreviewPicture(previewUrl);

  return (
    <AdminPageShell title="Sales - SKU vs Country" subtitle="Manage CPQ matrix products, brake-aware country availability, and BigCommerce validation.">
      <div className="matrixToolbar toolbar compactToolbar">
        <button onClick={() => setShowFilters((current) => !current)}>{showFilters ? 'Hide filters' : 'Show filters'}</button>
        <button onClick={() => setFilters(defaultFilters)}>Reset filters</button>
        <button className="primary" disabled={!canSingleUpdate || isSaving} onClick={saveAllDirtyRows}>Save changes</button>
        <select value={bulkCountryId} onChange={(e) => setBulkCountryId(Number(e.target.value))}><option value={0}>Bulk country</option>{countries.map((country) => <option key={country.id} value={country.id}>{country.country} ({country.region})</option>)}</select>
        <button disabled={!canBulkUpdate || !bulkCountryId || !targetRows.length} onClick={() => runBulkCountryUpdate(true)}>Assign country</button>
        <button disabled={!canBulkUpdate || !bulkCountryId || !targetRows.length} onClick={() => runBulkCountryUpdate(false)}>Remove country</button>
        <button className="primary" disabled={isCheckingBc || !targetRows.length} onClick={checkBcStatus}>{isCheckingBc ? 'Checking BC…' : 'Check BC status'}</button>
        <span className="subtle">Scope: {selectedInFiltered.length ? `${selectedInFiltered.length} selected` : `${filteredRows.length} filtered`} / {rows.length} total</span>
      </div>
      <div className={`matrixLayout tableViewport ${showFilters ? '' : 'matrixLayoutExpanded'}`}>
        {showFilters ? (
          <aside className="matrixFilters">
            <div className="filtersHeader"><strong>Filters</strong><button onClick={() => setFilters(defaultFilters)}>Reset</button></div>
            <label className="filterLabel">Ruleset</label>
            <select multiple className="multiSelect" value={filters.ruleset} onChange={(e) => setFilters((all) => ({ ...all, ruleset: selectedValues(e) }))}>
              {rulesets.map((ruleset) => <option key={ruleset} value={ruleset}>{ruleset}</option>)}
            </select>
            <label className="filterLabel">SKU search</label>
            <input value={filters.sku} onChange={(e) => setFilters((all) => ({ ...all, sku: e.target.value }))} placeholder="Search SKU" />

            <label className="filterLabel">BC Status</label>
            <select multiple className="multiSelect" value={filters.bc_status} onChange={(e) => setFilters((all) => ({ ...all, bc_status: selectedValues(e) as Array<'ok' | 'nok'> }))}>
              <option value="ok">OK</option>
              <option value="nok">NOK</option>
            </select>

            <label className="filterLabel">Country</label>
            <select multiple className="multiSelect" value={filters.country} onChange={(e) => setFilters((all) => ({ ...all, country: selectedValues(e) }))}>
              {countries.map((country) => <option key={country.country} value={country.country}>{country.country}</option>)}
            </select>

            <details open>
              <summary className="filterLabel">CPQ attribute filters</summary>
              <div className="matrixFilterGrid">
                {FILTER_FIELDS.map((field) => (
                  <label key={field.key} className="filterLabel">
                    {field.label}
                    <select
                      multiple
                      className="multiSelect"
                      value={filters.fields[field.key] || []}
                      onChange={(e) => setFilters((all) => ({ ...all, fields: { ...all.fields, [field.key]: selectedValues(e) } }))}
                    >
                      {(filterValueOptions[field.key] || []).map((option) => <option key={`${field.key}-${option}`} value={option}>{option}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </details>
          </aside>
        ) : null}
        <section className="matrixMainPane">
          {bcSummary ? <div className="note compactNote">{bcSummary}</div> : null}
          {saveSummary ? <div className="note compactNote">{saveSummary}</div> : null}
          {status ? <div className="note compactNote">{status}</div> : null}
          <div className="tableWrap matrixTableWrap">
            <table className="matrixTableOperational">
              <thead><tr><th>Pick</th><th>Ruleset</th><th>SKU</th><th>ProductLine</th><th>HandlebarType</th><th>Speeds</th><th>MudguardsAndRack</th><th>Brake</th><th>Description</th><th>Picture</th><th>BC Status</th><th>Countries</th></tr></thead>
              <tbody>
                {filteredRows.map((row) => {
                  const bcStatus = normalizeBcStatus(row.bc_status);
                  const hasPicture = hasLinkedPicture(row);
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
                    <td>
                      {hasPicture ? <span className="statusPill ok">Picture linked</span> : <span className="subtle">No picture</span>}
                      {hasPicture ? <div><a className="subtle" href={String(row.picture_asset_url)} target="_blank" rel="noreferrer">View asset</a></div> : null}
                      {canShowPickPictureAction(isPicturePickerEnabled) ? <div style={{ marginTop: 6 }}><button disabled={!canSingleUpdate} onClick={() => openPictureModal(row)}>Pick picture</button></div> : null}
                    </td>
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
      {canShowPickPictureAction(isPicturePickerEnabled) && pictureRow ? (
        <div className="modalBackdrop" onClick={() => setPictureRow(null)}>
          <div className="modalCard bdamModal" onClick={(e) => e.stopPropagation()}>
            <h3>Pick picture</h3>
            <p className="subtle">Browse BDAM in the embedded view. If needed, open BDAM in a new tab and paste the selected asset link below.</p>
            <div className="bdamEmbedWrap">
              {!iframeError ? (
                <iframe
                  src="https://dam.brompton.com/pages/home.php"
                  title="BDAM picture picker"
                  className="bdamFrame"
                  onError={() => setIframeError(true)}
                />
              ) : null}
              <div className="bdamFallback">
                <strong>Having trouble with the embedded BDAM view?</strong>
                <div className="subtle">If BDAM does not load in the embedded view, open it in a new tab and paste the selected asset link below.</div>
                <button onClick={() => window.open('https://dam.brompton.com/pages/home.php', '_blank', 'noopener,noreferrer')}>Open BDAM in new tab</button>
                {iframeError ? <div className="subtle">Embedded BDAM appears blocked by browser or site iframe restrictions.</div> : null}
              </div>
            </div>
            <div className="modalGrid" style={{ marginTop: 12 }}>
              <label>Asset URL
                <input value={pictureForm.asset_url} onChange={(e) => setPictureForm((curr) => ({ ...curr, asset_url: e.target.value }))} placeholder="https://dam.brompton.com/..." />
              </label>
              <label>PNG URL (optional)
                <input value={pictureForm.png_url} onChange={(e) => setPictureForm((curr) => ({ ...curr, png_url: e.target.value }))} placeholder="https://..." />
              </label>
              <label>Asset ID (optional)
                <input value={pictureForm.asset_id} onChange={(e) => setPictureForm((curr) => ({ ...curr, asset_id: e.target.value }))} />
              </label>
              <label>Notes (optional)
                <input value={pictureForm.notes} onChange={(e) => setPictureForm((curr) => ({ ...curr, notes: e.target.value }))} />
              </label>
            </div>
            {previewEnabled ? <div className="bdamPreview"><img src={previewUrl} alt="Selected asset preview" onError={() => setPictureStatus('Preview unavailable for this URL.')} /></div> : null}
            <div className="modalActions">
              <span className="subtle" style={{ marginRight: 'auto' }}>{pictureStatus}</span>
              <button onClick={() => setPictureRow(null)}>Cancel</button>
              <button className="primary" onClick={savePicture}>Save</button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminPageShell>
  );
}
