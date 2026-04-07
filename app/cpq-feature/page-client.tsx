'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import AdminPageShell from '@/components/admin/admin-page-shell';
import { CPQ_COLUMNS } from '@/lib/cpq';
import { safeReadJsonResponse } from '@/lib/http-json';
import { rowMatchesMultiSelectFilters, toggleColumnVisibility } from '@/lib/admin-table-ui';

type GeneratedRow = Record<string, any>;

type DigitChoice = {
  skuRuleId: number;
  cpqImportRowId: number | null;
  codeValue: string;
  choiceValue: string;
};

type DigitGroup = {
  digitPosition: number;
  optionName: string;
  choices: DigitChoice[];
};

function selectedValues(event: ChangeEvent<HTMLSelectElement>) {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

export default function CpqFeatureClient() {
  const [rows, setRows] = useState<GeneratedRow[]>([]);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [status, setStatus] = useState('');
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [visibleColumns, setVisibleColumns] = useState<string[]>(CPQ_COLUMNS);
  const [showFilters, setShowFilters] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [digitOptions, setDigitOptions] = useState<DigitGroup[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [productOptions, setProductOptions] = useState({
    productAssist: ['Electric', 'Non electric'],
    productFamily: ['Bike', 'P&A'],
    productLine: ['A Line', 'C Line', 'P Line', 'T Line', 'G Line'],
    productType: ['Standard', 'Special edition'],
    productModel: [] as string[]
  });
  const [form, setForm] = useState({
    cpqRuleset: '',
    productAssist: 'Non electric',
    productFamily: 'Bike',
    productLine: 'C Line',
    productType: 'Standard',
    productModel: ''
  });
  const [selectedCodesByDigit, setSelectedCodesByDigit] = useState<Record<number, string[]>>({});

  useEffect(() => {
    (async () => {
      setLoadingOptions(true);
      const res = await fetch('/api/cpq/options');
      const payload = await safeReadJsonResponse(res) as any;
      if (!res.ok) {
        setStatus(payload?.error || 'Failed to load options');
        setLoadingOptions(false);
        return;
      }
      setDigitOptions(Array.isArray(payload.digitOptions) ? payload.digitOptions : []);
      setProductOptions(payload.productFieldOptions || productOptions);
      setLoadingOptions(false);
    })();
  }, []);

  const filterOptions = useMemo(() => Object.fromEntries(CPQ_COLUMNS.map((column) => {
    const values = Array.from(new Set(rows.map((row) => String(row[column] || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return [column, values];
  })), [rows]);

  const filteredRows = useMemo(() => rows.filter((row) => rowMatchesMultiSelectFilters(row, filters)), [rows, filters]);
  const selectedCount = Object.values(picked).filter(Boolean).length;

  async function generateRows() {
    const selectedDigitChoices = digitOptions.flatMap((group) => {
      const selectedCodes = new Set(selectedCodesByDigit[group.digitPosition] || []);
      return group.choices.filter((choice) => selectedCodes.has(choice.codeValue)).map((choice) => ({
        digitPosition: group.digitPosition,
        optionName: group.optionName,
        codeValue: choice.codeValue,
        choiceValue: choice.choiceValue,
        cpqImportRowId: choice.cpqImportRowId
      }));
    });

    if (!form.cpqRuleset.trim() || !form.productModel.trim()) {
      setStatus('CPQ ruleset and ProductModel are required.');
      return;
    }
    if (!selectedDigitChoices.length) {
      setStatus('Select at least one digit-based option before generating.');
      return;
    }

    const res = await fetch('/api/cpq/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, selectedDigitChoices })
    });
    const payload = await safeReadJsonResponse(res) as any;
    if (!res.ok) {
      setStatus(payload?.error || 'Generation failed');
      return;
    }
    setRows(payload.rows || []);
    setPicked({});
    setStatus(`Generated ${payload.rows?.length || 0} SKU combination(s).`);
  }

  async function pushRows() {
    const selected = filteredRows.filter((_, index) => picked[index]);
    if (!selected.length) return setStatus('No selected rows to push.');

    const mode = window.prompt('Reverse brake or non reverse brake? Enter: reverse or non_reverse');
    if (!mode) return;

    const res = await fetch('/api/cpq/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: null, brakeMode: mode, rows: selected })
    });
    const payload = await safeReadJsonResponse(res) as any;
    if (!res.ok) return setStatus(payload?.error || 'Push failed');

    setStatus(`Push complete. Pushed: ${payload.pushed || 0}. Skipped duplicate SKU: ${payload.skippedDuplicateSkuCount || 0}. Failed rows: ${Array.isArray(payload.failedRows) ? payload.failedRows.length : 0}.`);
  }

  return (
    <AdminPageShell title="Product - Create SKU" subtitle="Select active DB choices, generate combinations, then push selected rows to Sales - SKU vs Country.">
      <div className="card compactCard compactSection">
        <div className="matrixFilterGrid featureFilterGrid">
          <label className="filterLabel">CPQ ruleset
            <input value={form.cpqRuleset} onChange={(e) => setForm((curr) => ({ ...curr, cpqRuleset: e.target.value }))} placeholder="e.g. C-Line-2026" />
          </label>
          <label className="filterLabel">ProductAssist
            <select value={form.productAssist} onChange={(e) => setForm((curr) => ({ ...curr, productAssist: e.target.value }))}>{productOptions.productAssist.map((v) => <option key={v}>{v}</option>)}</select>
          </label>
          <label className="filterLabel">ProductFamily
            <select value={form.productFamily} onChange={(e) => setForm((curr) => ({ ...curr, productFamily: e.target.value }))}>{productOptions.productFamily.map((v) => <option key={v}>{v}</option>)}</select>
          </label>
          <label className="filterLabel">ProductLine
            <select value={form.productLine} onChange={(e) => setForm((curr) => ({ ...curr, productLine: e.target.value }))}>{productOptions.productLine.map((v) => <option key={v}>{v}</option>)}</select>
          </label>
          <label className="filterLabel">ProductType
            <select value={form.productType} onChange={(e) => setForm((curr) => ({ ...curr, productType: e.target.value }))}>{productOptions.productType.map((v) => <option key={v}>{v}</option>)}</select>
          </label>
          <label className="filterLabel">ProductModel
            {form.productType === 'Special edition'
              ? <input value={form.productModel} onChange={(e) => setForm((curr) => ({ ...curr, productModel: e.target.value }))} placeholder="Special edition name" />
              : <input list="product-model-list" value={form.productModel} onChange={(e) => setForm((curr) => ({ ...curr, productModel: e.target.value }))} placeholder="Model" />}
            <datalist id="product-model-list">{productOptions.productModel.map((v) => <option key={v} value={v} />)}</datalist>
          </label>
        </div>
      </div>

      <div className="card compactCard compactSection">
        <div className="filtersHeader"><strong>Digit-based options (1-30)</strong></div>
        {loadingOptions ? <div className="subtle">Loading options...</div> : (
          <div className="matrixFilterGrid featureFilterGrid">
            {digitOptions.map((group) => (
              <label className="filterLabel" key={group.digitPosition}>Digit {group.digitPosition}: {group.optionName}
                <select multiple className="multiSelect" value={selectedCodesByDigit[group.digitPosition] || []} onChange={(e) => setSelectedCodesByDigit((curr) => ({ ...curr, [group.digitPosition]: selectedValues(e) }))}>
                  {group.choices.map((choice) => <option key={`${group.digitPosition}-${choice.codeValue}`} value={choice.codeValue}>{choice.codeValue} · {choice.choiceValue}</option>)}
                </select>
              </label>
            ))}
          </div>
        )}
        <div className="toolbar compactToolbar" style={{ marginTop: 10 }}>
          <button className="primary" onClick={generateRows}>Generate</button>
        </div>
      </div>

      <div className="cpqFeatureToolbar toolbar compactToolbar">
        <button onClick={() => setShowFilters((current) => !current)}>{showFilters ? 'Hide filters' : 'Show filters'}</button>
        <button onClick={() => setShowColumnManager((current) => !current)}>{showColumnManager ? 'Hide columns' : 'Columns'}</button>
        <button onClick={() => setPicked(Object.fromEntries(filteredRows.map((_, index) => [index, true])))}>Bulk select filtered</button>
        <button onClick={() => setPicked({})}>Clear selection</button>
        <button className="primary" onClick={pushRows}>Push selected to Sales - SKU vs Country</button>
        <span className="subtle">Selected: {selectedCount} · Filtered: {filteredRows.length} / {rows.length}</span>
      </div>

      {status ? <div className="note compactNote compactSection">{status}</div> : null}

      {showColumnManager ? (
        <div className="card compactCard columnManagerCard compactSection">
          <div className="filtersHeader"><strong>Column visibility</strong><button onClick={() => setVisibleColumns(CPQ_COLUMNS)}>Reset columns</button></div>
          <div className="columnToggleGrid">
            {CPQ_COLUMNS.map((column) => (
              <label key={column} className="choiceRow">
                <input type="checkbox" checked={visibleColumns.includes(column)} onChange={(e) => setVisibleColumns((current) => toggleColumnVisibility(current, CPQ_COLUMNS, column, e.target.checked))} />
                {column}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {showFilters ? (
        <div className="card compactCard compactSection">
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

      <div className="tableViewport"><div className="tableWrap cpqFeatureTableWrap"><table className="cpqFeatureTable">
        <thead><tr><th>Pick</th>{visibleColumns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {filteredRows.map((row, index) => (
            <tr key={`${row['SKU code']}-${index}`}>
              <td><input type="checkbox" checked={!!picked[index]} onChange={(e) => setPicked((curr) => ({ ...curr, [index]: e.target.checked }))} /></td>
              {visibleColumns.map((column) => <td key={`${column}-${index}`}>{row[column] || ''}</td>)}
            </tr>
          ))}
        </tbody>
      </table></div></div>
    </AdminPageShell>
  );
}
