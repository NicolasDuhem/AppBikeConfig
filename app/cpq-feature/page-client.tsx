'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminPageShell from '@/components/admin/admin-page-shell';
import { CPQ_COLUMNS } from '@/lib/cpq-core';
import { safeReadJsonResponse } from '@/lib/http-json';
import { rowMatchesMultiSelectFilters, toggleColumnVisibility } from '@/lib/admin-table-ui';

type GeneratedRow = Record<string, any>;
type GeneratedRowWithKey = GeneratedRow & { _rowKey: string };

type DigitChoice = {
  cpqImportRowId: number;
  codeValue: string;
  choiceValue: string;
};

type DigitGroup = {
  digitPosition: number;
  optionName: string;
  isRequired: boolean;
  selectionMode: 'single' | 'multi';
  choices: DigitChoice[];
};


const defaultProductOptions = {
  productAssist: ['Electric', 'Non electric'],
  productFamily: ['Bike', 'P&A'],
  productLine: ['A Line', 'C Line', 'P Line', 'T Line', 'G Line'],
  productType: ['Standard', 'Special edition'],
  productModel: [] as string[]
};

function buildRowKey(row: GeneratedRow, index: number) {
  const skuCode = String(row['SKU code'] || '').trim();
  const description = String(row.Description || '').trim();
  if (skuCode) return `${skuCode}-${index}`;
  return `${description || 'row'}-${index}`;
}

export default function CpqFeatureClient() {
  const [rows, setRows] = useState<GeneratedRowWithKey[]>([]);
  const [pickedRowKeys, setPickedRowKeys] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState('');
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [headerFilters, setHeaderFilters] = useState<Record<string, string>>({});
  const [filterSearch, setFilterSearch] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<string[]>(CPQ_COLUMNS);
  const [showFilters, setShowFilters] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [showDigitFilters, setShowDigitFilters] = useState(false);
  const [digitOptions, setDigitOptions] = useState<DigitGroup[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [productOptions, setProductOptions] = useState(defaultProductOptions);
  const [optionLocale, setOptionLocale] = useState('en-US');
  const [availableLocales, setAvailableLocales] = useState<string[]>(['en-US']);
  const [optionLocaleSource, setOptionLocaleSource] = useState<'request' | 'country' | 'default'>('default');
  const [form, setForm] = useState({
    cpqRuleset: '',
    productAssist: 'Non electric',
    productFamily: 'Bike',
    productLine: 'C Line',
    productType: 'Standard',
    productModel: ''
  });
  const [selectedCodesByDigit, setSelectedCodesByDigit] = useState<Record<number, string[]>>({});

  const loadOptions = useCallback(async (requestedLocale: string) => {
    setLoadingOptions(true);
    const params = new URLSearchParams();
    if (requestedLocale) params.set('locale', requestedLocale);
    const res = await fetch(`/api/cpq/options?${params.toString()}`);
    const payload = await safeReadJsonResponse(res) as any;
    if (!res.ok) {
      setStatus(payload?.error || 'Failed to load options');
      setLoadingOptions(false);
      return;
    }
    setDigitOptions(Array.isArray(payload.digitOptions) ? payload.digitOptions : []);
    setProductOptions(payload.productFieldOptions || defaultProductOptions);
    const resolvedLocale = String(payload.locale || requestedLocale || 'en-US');
    const locales = Array.isArray(payload.locales) && payload.locales.length ? payload.locales : ['en-US'];
    setOptionLocale(resolvedLocale);
    setAvailableLocales(locales);
    setOptionLocaleSource(payload.localeSource === 'request' || payload.localeSource === 'country' ? payload.localeSource : 'default');
    setLoadingOptions(false);
  }, []);

  useEffect(() => {
    loadOptions('en-US');
  }, [loadOptions]);

  const filterOptions = useMemo(() => Object.fromEntries(CPQ_COLUMNS.map((column) => {
    const values = Array.from(new Set(rows.map((row) => String(row[column] || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return [column, values];
  })), [rows]);

  const filteredFilterColumns = useMemo(() => visibleColumns.filter((column) => column.toLowerCase().includes(filterSearch.toLowerCase())), [filterSearch, visibleColumns]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    if (!rowMatchesMultiSelectFilters(row, filters)) return false;
    return visibleColumns.every((column) => {
      const query = (headerFilters[column] || '').trim().toLowerCase();
      if (!query) return true;
      return String(row[column] || '').toLowerCase().includes(query);
    });
  }), [rows, filters, headerFilters, visibleColumns]);
  const selectedCount = pickedRowKeys.size;
  const allVisibleSelected = !!filteredRows.length && filteredRows.every((row) => pickedRowKeys.has(row._rowKey));

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
    const generatedRows = (payload.rows || []).map((row: GeneratedRow, index: number) => ({ ...row, _rowKey: buildRowKey(row, index) }));
    setRows(generatedRows);
    setPickedRowKeys(new Set());
    setStatus(`Generated ${payload.rows?.length || 0} SKU combination(s).`);
  }

  async function pushRows() {
    const selected = rows.filter((row) => pickedRowKeys.has(row._rowKey));
    if (!selected.length) return setStatus('No selected rows to push.');

    const mode = window.prompt('Reverse brake or non reverse brake? Enter: reverse or non_reverse');
    if (!mode) return;

    const res = await fetch('/api/cpq/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: null, brakeMode: mode, rows: selected.map(({ _rowKey, ...row }) => row) })
    });
    const payload = await safeReadJsonResponse(res) as any;
    if (!res.ok) return setStatus(payload?.error || 'Push failed');

    setStatus(`Push complete. Pushed: ${payload.pushed || 0}. Skipped duplicate SKU: ${payload.skippedDuplicateSkuCount || 0}. Failed rows: ${Array.isArray(payload.failedRows) ? payload.failedRows.length : 0}.`);
  }

  function setDigitChoice(digitPosition: number, codeValue: string, selectionMode: 'single' | 'multi') {
    setSelectedCodesByDigit((current) => {
      const selectedCodes = new Set(current[digitPosition] || []);
      if (selectionMode === 'single') {
        if (selectedCodes.has(codeValue)) return { ...current, [digitPosition]: [] };
        return { ...current, [digitPosition]: [codeValue] };
      }
      if (selectedCodes.has(codeValue)) selectedCodes.delete(codeValue);
      else selectedCodes.add(codeValue);
      return { ...current, [digitPosition]: Array.from(selectedCodes) };
    });
  }

  function toggleSelectAllVisible(checked: boolean) {
    setPickedRowKeys((current) => {
      const next = new Set(current);
      filteredRows.forEach((row) => {
        if (checked) next.add(row._rowKey);
        else next.delete(row._rowKey);
      });
      return next;
    });
  }

  return (
    <AdminPageShell title="Product - Create SKU" subtitle="Select active DB choices, generate combinations, then push selected rows to Sales - SKU vs Country.">
      <div className="cpqFeaturePage">
      <div className="card compactCard compactSection cpqMetaCard">
        <div className="matrixFilterGrid featureFilterGrid cpqMetaGrid">
          <label className="filterLabel">CPQ ruleset
            <input value={form.cpqRuleset} onChange={(e) => setForm((curr) => ({ ...curr, cpqRuleset: e.target.value }))} placeholder="e.g. C-Line-2026" />
          </label>
          <label className="filterLabel">Option locale
            <select
              value={optionLocale}
              onChange={async (e) => {
                const nextLocale = e.target.value;
                setOptionLocale(nextLocale);
                await loadOptions(nextLocale);
              }}
            >
              {availableLocales.map((locale) => <option key={locale} value={locale}>{locale}</option>)}
            </select>
            <span className="subtle">Source: {optionLocaleSource === 'request' ? 'explicit selection' : optionLocaleSource === 'country' ? 'country default locale' : 'managed default locale'}</span>
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
        <div className="filtersHeader">
          <strong className="digitFilterTitle">Digit-based options (1-30)</strong>
          <div className="cpqFeatureHeaderActions">
            <button onClick={() => setShowDigitFilters((current) => !current)}>{showDigitFilters ? 'Collapse' : 'Expand'}</button>
            <button onClick={() => setSelectedCodesByDigit({})}>Reset option selections</button>
          </div>
        </div>
        {showDigitFilters ? (
          loadingOptions ? <div className="subtle">Loading options...</div> : (
            <div className="digitFiltersViewport">
            <div className="digitFilterGrid">
              {digitOptions.map((group) => (
                <section className="digitFilterCard" key={group.digitPosition}>
                  <header className="digitFilterCardHeader">
                    <h4>
                      <span>Digit {group.digitPosition}:</span> <span>{group.optionName}</span>
                    </h4>
                    <div className="subtle">{group.isRequired ? 'Required' : 'Optional'} · {group.selectionMode === 'single' ? 'Single select' : 'Multi select'}</div>
                  </header>
                  <div className="choiceList digitChoiceList">
                    {group.choices.map((choice) => (
                      <label key={`${group.digitPosition}-${choice.codeValue}`} className="choiceRow">
                        <input
                          type="checkbox"
                          checked={(selectedCodesByDigit[group.digitPosition] || []).includes(choice.codeValue)}
                          onChange={() => setDigitChoice(group.digitPosition, choice.codeValue, group.selectionMode)}
                        />
                        <span className="digitChoiceLabel">{choice.codeValue} · {choice.choiceValue}</span>
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            </div>
          )
        ) : <div className="subtle">Collapsed by default for a cleaner workspace. Expand when you need digit-level filters.</div>}
        <div className="toolbar compactToolbar cpqFeatureSectionActions">
          <button className="primary" onClick={generateRows}>Generate table rows</button>
        </div>
      </div>

      <div className="cpqFeatureToolbar toolbar compactToolbar">
        <button onClick={() => setShowFilters((current) => !current)}>{showFilters ? 'Hide filters' : 'Show filters'}</button>
        <button onClick={() => setShowColumnManager((current) => !current)}>{showColumnManager ? 'Hide columns' : 'Columns'}</button>
        <button onClick={() => toggleSelectAllVisible(true)}>Select all visible</button>
        <button onClick={() => toggleSelectAllVisible(false)}>Unselect all visible</button>
        <button onClick={() => setPickedRowKeys(new Set())}>Clear selection</button>
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
          <div className="filtersHeader"><strong>Generated bike filters</strong><button onClick={() => { setFilters({}); setFilterSearch(''); }}>Reset filters</button></div>
          <input placeholder="Search filter column..." value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} style={{ marginBottom: 8 }} />
          <div className="matrixFilterGrid featureFilterGrid">
            {filteredFilterColumns.map((column) => (
              <label key={`filter-${column}`} className="filterLabel">
                {column}
                <select multiple className="multiSelect" value={filters[column] || []} onChange={(e) => setFilters((curr) => ({ ...curr, [column]: Array.from(e.target.selectedOptions).map((option) => option.value) }))}>
                  {(filterOptions[column] || []).map((value) => <option key={`${column}-${value}`} value={value}>{value}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="tableViewport"><div className="tableWrap cpqFeatureTableWrap"><table className="cpqFeatureTable">
        <thead>
          <tr>
            <th>
              <div className="tableSelectControls">
                <label className="choiceRow">
                  <input type="checkbox" checked={allVisibleSelected} onChange={(e) => toggleSelectAllVisible(e.target.checked)} />
                  All visible
                </label>
                <button onClick={() => toggleSelectAllVisible(false)}>Unselect visible</button>
              </div>
            </th>
            {visibleColumns.map((column) => <th key={column}>{column}</th>)}
          </tr>
          <tr className="filterRow">
            <th />
            {visibleColumns.map((column) => (
              <th key={`filter-${column}`}>
                <input
                  value={headerFilters[column] || ''}
                  onChange={(e) => setHeaderFilters((current) => ({ ...current, [column]: e.target.value }))}
                  placeholder="Filter..."
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row) => (
            <tr key={row._rowKey}>
              <td><input type="checkbox" checked={pickedRowKeys.has(row._rowKey)} onChange={(e) => setPickedRowKeys((current) => {
                const next = new Set(current);
                if (e.target.checked) next.add(row._rowKey);
                else next.delete(row._rowKey);
                return next;
              })} /></td>
              {visibleColumns.map((column) => <td key={`${column}-${row._rowKey}`}>{row[column] || ''}</td>)}
            </tr>
          ))}
        </tbody>
      </table></div></div>
      </div>
    </AdminPageShell>
  );
}
