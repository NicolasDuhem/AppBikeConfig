'use client';

import { useMemo, useState, type ChangeEvent } from 'react';
import AdminPageShell from '@/components/admin/admin-page-shell';
import { CPQ_COLUMNS } from '@/lib/cpq';
import { safeReadJsonResponse } from '@/lib/http-json';
import { rowMatchesMultiSelectFilters, toggleColumnVisibility } from '@/lib/admin-table-ui';

type GeneratedRow = Record<string, string>;

type ApiPayload = {
  ok?: boolean;
  success?: boolean;
  error?: string;
  message?: string;
  details?: any;
  runId?: number;
  importRunId?: number;
  phase?: string;
  summary?: any;
  diagnostics?: any;
  rows?: GeneratedRow[];
  pushed?: number;
  skippedDuplicateSkuCount?: number;
  skippedDuplicateSkus?: string[];
  failedRows?: Array<{ skuCode: string; cpqRuleset: string; reason: string }>;
  dryRun?: boolean;
};

type ImportDebugData = {
  importRunId: number | null;
  phase: string;
  message: string;
  details?: any;
  summary?: any;
};

function buildErrorMessage(payload: ApiPayload, fallback: string) {
  const details = payload?.details;
  const rowErrors = Array.isArray(details?.errors) ? details.errors : Array.isArray(payload?.summary?.rowIssues) ? payload.summary.rowIssues : [];
  const firstRows = rowErrors.slice(0, 5).map((err: any) => `Row ${err.rowNumber}: ${err.reason}`).join(' | ');
  const phase = payload?.phase ? ` (phase: ${payload.phase})` : '';
  const rootMessage = `${payload?.message || payload?.error || fallback}${phase}`;
  return firstRows ? `${rootMessage}. ${firstRows}` : rootMessage;
}

function selectedValues(event: ChangeEvent<HTMLSelectElement>) {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

export default function CpqFeatureClient() {
  const [file, setFile] = useState<File | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [runId, setRunId] = useState<number | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [debugData, setDebugData] = useState<ImportDebugData | null>(null);
  const [rows, setRows] = useState<GeneratedRow[]>([]);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [status, setStatus] = useState('');
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [visibleColumns, setVisibleColumns] = useState<string[]>(CPQ_COLUMNS);
  const [showFilters, setShowFilters] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [wizard, setWizard] = useState({ selectedLine: 'C Line', electricType: 'Non electric', isSpecial: 'No', specialEditionName: '', character17: '', dryRun: false });

  const filterOptions = useMemo(() => {
    return Object.fromEntries(CPQ_COLUMNS.map((column) => {
      const values = Array.from(new Set(rows.map((row) => String(row[column] || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
      return [column, values];
    }));
  }, [rows]);

  const filteredRows = useMemo(() => rows.filter((row) => rowMatchesMultiSelectFilters(row, filters)), [rows, filters]);
  const selectedCount = Object.values(picked).filter(Boolean).length;

  async function runImport() {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('selectedLine', wizard.selectedLine);
    form.append('electricType', wizard.electricType);
    form.append('isSpecial', wizard.isSpecial);
    form.append('specialEditionName', wizard.specialEditionName);
    form.append('character17', wizard.character17);
    form.append('dryRun', String(wizard.dryRun));

    const res = await fetch('/api/cpq/import', { method: 'POST', body: form });
    const payload = await safeReadJsonResponse(res) as ApiPayload;
    const returnedRunId = payload.importRunId || payload.runId || null;

    setDebugData({
      importRunId: returnedRunId,
      phase: payload.phase || 'unknown',
      message: payload.message || (res.ok ? 'Import completed' : 'Import failed'),
      details: payload.details,
      summary: payload.summary
    });

    if (!res.ok || !returnedRunId) {
      setStatus(buildErrorMessage(payload, 'Import failed'));
      return;
    }

    setRunId(returnedRunId);
    setSummary(payload.summary);

    if (payload.dryRun) {
      setStatus(`Dry-run completed for run ${returnedRunId}. Review diagnostics before importing.`);
      setShowWizard(false);
      return;
    }

    setStatus('Import successful. Generating combinations...');
    setShowWizard(false);

    try {
      const genRes = await fetch(`/api/cpq/generate?run_id=${returnedRunId}`);
      const genPayload = await safeReadJsonResponse(genRes) as ApiPayload;
      if (!genRes.ok) {
        setDebugData({
          importRunId: returnedRunId,
          phase: genPayload.phase || 'generation_failed',
          message: genPayload.message || genPayload.error || 'Generation failed',
          details: genPayload.details,
          summary: genPayload.summary || { diagnostics: genPayload.details || null }
        });
        setStatus(buildErrorMessage(genPayload, 'Import succeeded but generation failed'));
        return;
      }

      setRows(genPayload.rows || []);
      setPicked({});
      setDebugData({
        importRunId: returnedRunId,
        phase: genPayload.phase || 'generation_completed',
        message: `Generation completed (${genPayload.rows?.length || 0} rows).`,
        details: genPayload.details || genPayload.diagnostics,
        summary: genPayload.summary
      });
      setStatus(`Generated ${genPayload.rows?.length || 0} CPQ variation(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error during generation';
      setDebugData({
        importRunId: returnedRunId,
        phase: 'generation_failed',
        message,
        details: { error: message }
      });
      setStatus(`Import succeeded but generation request failed: ${message}`);
    }
  }

  async function pushRows() {
    const selected = filteredRows.filter((_, index) => picked[index]);
    if (!selected.length) {
      setStatus('No selected rows to push.');
      return;
    }

    const mode = window.prompt('Reverse brake or non reverse brake? Enter: reverse or non_reverse');
    if (!mode) return;
    const res = await fetch('/api/cpq/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, brakeMode: mode, rows: selected })
    });
    const payload = await safeReadJsonResponse(res) as ApiPayload;
    if (!res.ok) {
      setStatus(buildErrorMessage(payload, 'Push failed'));
      return;
    }

    const pushed = payload.pushed || 0;
    const duplicateSkips = payload.skippedDuplicateSkuCount || 0;
    const failedRows = Array.isArray(payload.failedRows) ? payload.failedRows.length : 0;
    setStatus(`Push complete. Pushed: ${pushed}. Skipped duplicate SKU: ${duplicateSkips}. Failed rows: ${failedRows}.`);
  }

  return (
    <AdminPageShell title="CPQ Feature" subtitle="Import CPQ CSV, generate combinations, filter quickly, and push selected rows.">
      <div className="cpqFeatureHeaderRow">
        <div className="cpqFeatureFilePicker">
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button className="primary" disabled={!file} onClick={() => setShowWizard(true)}>Import CSV</button>
        </div>
        <div className="summaryChips compactSummaryRow">
          {summary ? (
            <>
              <span className="summaryChip">Rows read: {summary.rowsRead}</span>
              <span className="summaryChip active">Imported: {summary.rowsImported}</span>
              <span className="summaryChip">Skipped: {summary.rowsSkipped}</span>
              <span className="summaryChip inactive">Duplicate skipped: {summary.duplicateRowsSkipped || 0}</span>
            </>
          ) : <span className="summaryChip">No import run yet</span>}
        </div>
      </div>

      <div className="cpqFeatureToolbar toolbar compactToolbar">
        <button onClick={() => setShowFilters((current) => !current)}>{showFilters ? 'Hide filters' : 'Show filters'}</button>
        <button onClick={() => setShowColumnManager((current) => !current)}>{showColumnManager ? 'Hide columns' : 'Columns'}</button>
        <button onClick={() => setPicked(Object.fromEntries(filteredRows.map((_, index) => [index, true])))}>Bulk select filtered</button>
        <button onClick={() => setPicked({})}>Clear selection</button>
        <button className="primary" onClick={pushRows}>Push selected</button>
        <span className="subtle">Selected: {selectedCount} · Filtered: {filteredRows.length} / {rows.length}</span>
      </div>

      {status ? <div className="note compactNote">{status}</div> : null}
      {debugData ? <div className="note compactNote">Run {debugData.importRunId ?? 'n/a'} · {debugData.phase}: {debugData.message}</div> : null}

      {showColumnManager ? (
        <div className="card compactCard columnManagerCard">
          <div className="filtersHeader">
            <strong>Column visibility</strong>
            <button onClick={() => setVisibleColumns(CPQ_COLUMNS)}>Reset columns</button>
          </div>
          <div className="columnToggleGrid">
            {CPQ_COLUMNS.map((column) => (
              <label key={column} className="choiceRow">
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(column)}
                  onChange={(e) => setVisibleColumns((current) => toggleColumnVisibility(current, CPQ_COLUMNS, column, e.target.checked))}
                />
                {column}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {showFilters ? (
        <div className="card compactCard">
          <div className="filtersHeader"><strong>Generated bike filters</strong><button onClick={() => setFilters({})}>Reset filters</button></div>
          <div className="matrixFilterGrid featureFilterGrid">
            {visibleColumns.map((column) => (
              <label key={`filter-${column}`} className="filterLabel">
                {column}
                <select multiple className="multiSelect" value={filters[column] || []} onChange={(e) => setFilters((curr) => ({ ...curr, [column]: selectedValues(e) }))}>
                  {(filterOptions[column] || []).map((value) => <option key={`${column}-${value}`} value={value}>{value}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="tableWrap cpqFeatureTableWrap">
        <table className="cpqFeatureTable">
          <thead>
            <tr>
              <th>Pick</th>
              {visibleColumns.map((column) => <th key={column}>{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, index) => (
              <tr key={`${row['SKU code']}-${index}`}>
                <td><input type="checkbox" checked={!!picked[index]} onChange={(e) => setPicked((curr) => ({ ...curr, [index]: e.target.checked }))} /></td>
                {visibleColumns.map((column) => <td key={`${column}-${index}`}>{row[column] || ''}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showWizard ? (
        <div className="modalBackdrop">
          <div className="modalCard" style={{ width: 620 }}>
            <h3>CPQ import metadata</h3>
            <div className="modalGrid">
              <label>Select a Line
                <select value={wizard.selectedLine} onChange={(e) => setWizard((curr) => ({ ...curr, selectedLine: e.target.value }))}>
                  <option>C Line</option><option>P Line</option><option>T Line</option><option>G Line</option><option>A Line</option>
                </select>
              </label>
              <label>Electric type
                <select value={wizard.electricType} onChange={(e) => setWizard((curr) => ({ ...curr, electricType: e.target.value }))}>
                  <option>Non electric</option><option>Electric</option>
                </select>
              </label>
              <label>Is it a special?
                <select value={wizard.isSpecial} onChange={(e) => setWizard((curr) => ({ ...curr, isSpecial: e.target.value }))}>
                  <option>No</option><option>Yes</option>
                </select>
              </label>
              {wizard.isSpecial === 'Yes' ? <label>Special edition name<input value={wizard.specialEditionName} onChange={(e) => setWizard((curr) => ({ ...curr, specialEditionName: e.target.value }))} /></label> : null}
              <label>Character 17
                <input maxLength={1} value={wizard.character17} onChange={(e) => setWizard((curr) => ({ ...curr, character17: e.target.value.toUpperCase() }))} />
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={wizard.dryRun} onChange={(e) => setWizard((curr) => ({ ...curr, dryRun: e.target.checked }))} />
                Validate only (dry-run)
              </label>
            </div>
            <div className="modalActions">
              <button onClick={() => setShowWizard(false)}>Cancel</button>
              <button className="primary" onClick={runImport}>{wizard.dryRun ? 'Run validation' : 'Confirm import'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminPageShell>
  );
}
