'use client';

import { useMemo, useState } from 'react';
import AdminPageShell from '@/components/admin/admin-page-shell';
import { CPQ_COLUMNS } from '@/lib/cpq';
import { safeReadJsonResponse } from '@/lib/http-json';

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
  rows?: GeneratedRow[];
  pushed?: number;
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

export default function CpqFeatureClient() {
  const [file, setFile] = useState<File | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [runId, setRunId] = useState<number | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [debugData, setDebugData] = useState<ImportDebugData | null>(null);
  const [rows, setRows] = useState<GeneratedRow[]>([]);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [status, setStatus] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [wizard, setWizard] = useState({ selectedLine: 'C Line', electricType: 'Non electric', isSpecial: 'No', specialEditionName: '', character17: '', dryRun: false });

  const filteredRows = useMemo(() => rows.filter((row) => Object.entries(filters).every(([key, value]) => !value || String(row[key] || '').toLowerCase().includes(value.toLowerCase()))), [rows, filters]);
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

    const genRes = await fetch(`/api/cpq/generate?run_id=${returnedRunId}`);
    const genPayload = await safeReadJsonResponse(genRes) as ApiPayload;
    if (!genRes.ok) {
      setStatus(buildErrorMessage(genPayload, 'Import succeeded but generation failed'));
      return;
    }

    setRows(genPayload.rows || []);
    setPicked({});
    setStatus(`Generated ${genPayload.rows?.length || 0} CPQ variation(s).`);
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

    setStatus(`Pushed ${payload.pushed || 0} row(s) to CPQ matrix.`);
  }

  return (
    <AdminPageShell title="CPQ Feature" subtitle="Import CPQ CSV, update Bike SKU Definition, generate variations, and push selected rows to CPQ matrix.">
      <div className="card" style={{ marginBottom: 12 }}>
        <h3>Import CPQ CSV</h3>
        <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button className="primary" disabled={!file} onClick={() => setShowWizard(true)} style={{ marginLeft: 8 }}>Start import wizard</button>
      </div>

      {summary ? <div className="note">Rows read: {summary.rowsRead} · Imported: {summary.rowsImported} · Skipped: {summary.rowsSkipped} · Duplicate skipped: {summary.duplicateRowsSkipped || 0} · Unknown options: {summary.unknownOptionsSkipped || 0}</div> : null}
      <div className="note">{status || 'Upload a file and run import.'}</div>

      {debugData ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3>Last import diagnostics</h3>
          <div className="subtle">Run ID: {debugData.importRunId ?? 'n/a'} · Phase: {debugData.phase}</div>
          <div>{debugData.message}</div>
          {Array.isArray(debugData?.details?.errors) ? (
            <ul>
              {debugData.details.errors.slice(0, 10).map((error: any, index: number) => (
                <li key={`${error.rowNumber}-${index}`}>Row {error.rowNumber}: {error.reason}</li>
              ))}
            </ul>
          ) : null}
          {Array.isArray(debugData?.summary?.rowIssues) ? (
            <ul>
              {debugData.summary.rowIssues.slice(0, 10).map((issue: any, index: number) => (
                <li key={`${issue.rowNumber}-${index}`}>Row {issue.rowNumber}: {issue.reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="toolbar">
        <button onClick={() => setPicked(Object.fromEntries(filteredRows.map((_, index) => [index, true])))}>Bulk select filtered</button>
        <button onClick={() => setPicked({})}>Clear selection</button>
        <button className="primary" onClick={pushRows}>Push selected to new CPQ matrix</button>
        <span className="subtle">Selected rows: {selectedCount}</span>
      </div>

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Pick</th>
              {CPQ_COLUMNS.map((column) => <th key={column}>{column}</th>)}
            </tr>
            <tr className="filterRow">
              <th />
              {CPQ_COLUMNS.map((column) => (
                <th key={`f-${column}`}><input placeholder="Filter" value={filters[column] || ''} onChange={(e) => setFilters((curr) => ({ ...curr, [column]: e.target.value }))} /></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, index) => (
              <tr key={`${row['SKU code']}-${index}`}>
                <td><input type="checkbox" checked={!!picked[index]} onChange={(e) => setPicked((curr) => ({ ...curr, [index]: e.target.checked }))} /></td>
                {CPQ_COLUMNS.map((column) => <td key={`${column}-${index}`}>{row[column] || ''}</td>)}
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
