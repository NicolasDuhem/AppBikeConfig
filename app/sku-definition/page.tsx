'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SkuDigitIssue, SkuRule, SkuRuleTranslationRow } from '@/lib/types';
import { defaultRuleFilters, filterSkuRules, getRuleActionLabel, type RuleFilters } from '@/lib/sku-rule-filters';
import AdminPageShell from '@/components/admin/admin-page-shell';

type SkuDefinitionSection = 'rules' | 'translations';

export default function SkuDefinitionPage() {
  const [activeSection, setActiveSection] = useState<SkuDefinitionSection>('rules');
  const [rules, setRules] = useState<SkuRule[]>([]);
  const [digitIssues, setDigitIssues] = useState<SkuDigitIssue[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [status, setStatus] = useState('');
  const [filters, setFilters] = useState<RuleFilters>(defaultRuleFilters);
  const [form, setForm] = useState({ digit_position: 1, option_name: '', code_value: '', choice_value: '', description_element: '' });
  const [pendingDeactivate, setPendingDeactivate] = useState<SkuRule | null>(null);
  const [pendingEdit, setPendingEdit] = useState<SkuRule | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SkuRule | null>(null);
  const [editChoiceValue, setEditChoiceValue] = useState('');
  const [editDescriptionElement, setEditDescriptionElement] = useState('');
  const [deactivationReason, setDeactivationReason] = useState('');

  const [translationRows, setTranslationRows] = useState<SkuRuleTranslationRow[]>([]);
  const [translationLocales, setTranslationLocales] = useState<string[]>([]);
  const [translationLocale, setTranslationLocale] = useState('en-US');
  const [translationIncludeInactive, setTranslationIncludeInactive] = useState(false);
  const [translationSearch, setTranslationSearch] = useState('');
  const [translationDrafts, setTranslationDrafts] = useState<Record<number, string>>({});
  const [translationStatus, setTranslationStatus] = useState('');
  const [translationSaving, setTranslationSaving] = useState(false);

  async function load() {
    const [rulesRes, meRes] = await Promise.all([
      fetch('/api/sku-rules?include_inactive=1'),
      fetch('/api/me')
    ]);
    const payload = await rulesRes.json();
    setRules((payload.rows || []) as SkuRule[]);
    setDigitIssues((payload.digitIssues || []) as SkuDigitIssue[]);
    const me = await meRes.json();
    setCanManage((me.permissions || []).includes('sku.manage'));
    setCanDelete((me.permissions || []).includes('sku.delete'));
  }

  async function loadTranslations(locale = translationLocale, includeInactive = translationIncludeInactive) {
    const params = new URLSearchParams({ locale });
    if (includeInactive) params.set('include_inactive', '1');

    const res = await fetch(`/api/sku-rule-translations?${params.toString()}`);
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setTranslationStatus(payload.error || 'Failed to load translations');
      return;
    }

    const locales = (payload.locales || []) as string[];
    const resolvedLocale = String(payload.locale || locale || 'en-US');
    setTranslationLocales(locales.length ? locales : ['en-US']);
    setTranslationLocale(resolvedLocale);
    setTranslationRows((payload.rows || []) as SkuRuleTranslationRow[]);
    setTranslationDrafts({});
    setTranslationStatus('');
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (activeSection !== 'translations') return;
    loadTranslations();
  }, [activeSection]);

  const knownDigitOptionName = useMemo(() => {
    const row = rules.find((rule) => rule.digit_position === form.digit_position);
    return row?.option_name || '';
  }, [form.digit_position, rules]);

  useEffect(() => {
    if (knownDigitOptionName) {
      setForm((v) => ({ ...v, option_name: knownDigitOptionName }));
    }
  }, [knownDigitOptionName]);

  async function addRule() {
    if (!canManage) return;
    setStatus('Saving...');
    const res = await fetch('/api/sku-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const payload = await res.json().catch(() => ({}));
    setStatus(res.ok ? 'Rule saved' : payload.error || 'Save failed');
    if (res.ok) {
      setForm({ digit_position: 1, option_name: '', code_value: '', choice_value: '', description_element: '' });
      await load();
    }
  }

  async function deleteRule(rule: SkuRule) {
    if (!canDelete) return;
    const res = await fetch(`/api/sku-rules?id=${rule.id}`, { method: 'DELETE' });
    const payload = await res.json().catch(() => ({}));
    setStatus(res.ok ? 'Rule permanently deleted.' : payload.error || 'Delete failed');
    if (res.ok) {
      setPendingDelete(null);
      await load();
      if (activeSection === 'translations') await loadTranslations();
    }
  }

  async function saveEdit() {
    if (!canManage || !pendingEdit) return;
    const res = await fetch('/api/sku-rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pendingEdit.id, choice_value: editChoiceValue, description_element: editDescriptionElement })
    });
    const payload = await res.json().catch(() => ({}));
    setStatus(res.ok ? 'Rule updated' : payload.error || 'Update failed');
    if (res.ok) {
      setPendingEdit(null);
      setEditChoiceValue('');
      setEditDescriptionElement('');
      await load();
      if (activeSection === 'translations') await loadTranslations();
    }
  }

  async function toggleActive(rule: SkuRule, reason = '') {
    if (!canManage) return;
    const nextActive = !rule.is_active;
    const res = await fetch('/api/sku-rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, is_active: nextActive, deactivation_reason: reason })
    });
    const payload = await res.json().catch(() => ({}));
    setStatus(res.ok ? (nextActive ? 'Rule reactivated' : 'Rule deactivated') : payload.error || 'Update failed');
    if (res.ok) {
      setPendingDeactivate(null);
      setDeactivationReason('');
      await load();
      if (activeSection === 'translations') await loadTranslations();
    }
  }

  function updateTranslationDraft(rowId: number, value: string) {
    setTranslationDrafts((current) => ({ ...current, [rowId]: value }));
  }

  async function saveTranslations() {
    if (!canManage || !translationLocale || !Object.keys(translationDrafts).length) return;

    const updates = Object.entries(translationDrafts).map(([cpqImportRowId, translatedValue]) => ({
      cpq_import_row_id: Number(cpqImportRowId),
      translated_value: translatedValue
    }));

    setTranslationSaving(true);
    setTranslationStatus('Saving translations...');
    const res = await fetch('/api/sku-rule-translations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: translationLocale, updates })
    });
    const payload = await res.json().catch(() => ({}));
    setTranslationSaving(false);
    if (!res.ok) {
      setTranslationStatus(payload.error || 'Failed to save translations');
      return;
    }

    setTranslationStatus(`Saved ${payload.saved?.length || 0} translation(s); cleared ${payload.cleared?.length || 0}.`);
    await loadTranslations(translationLocale, translationIncludeInactive);
  }

  const filteredRules = useMemo(() => filterSkuRules(rules, filters), [filters, rules]);

  const filteredTranslationRows = useMemo(() => {
    const term = translationSearch.trim().toLowerCase();
    const rows = translationRows.filter((row) => {
      if (!term) return true;
      return [
        String(row.digit_position),
        row.option_name,
        row.code_value,
        row.choice_value,
        row.translated_value || ''
      ].some((value) => String(value || '').toLowerCase().includes(term));
    });
    return rows;
  }, [translationRows, translationSearch]);

  const translationSummary = useMemo(() => {
    const total = filteredTranslationRows.length;
    const completed = filteredTranslationRows.filter((row) => {
      const value = Object.prototype.hasOwnProperty.call(translationDrafts, row.cpq_import_row_id)
        ? translationDrafts[row.cpq_import_row_id]
        : row.translated_value || '';
      return !!String(value || '').trim();
    }).length;
    return { total, completed, missing: Math.max(total - completed, 0), dirty: Object.keys(translationDrafts).length };
  }, [filteredTranslationRows, translationDrafts]);

  function updateFilter<K extends keyof RuleFilters>(key: K, value: RuleFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters(defaultRuleFilters);
  }

  const statusSummary = {
    total: rules.length,
    active: rules.filter((rule) => rule.is_active).length,
    inactive: rules.filter((rule) => !rule.is_active).length
  };

  return (
    <AdminPageShell title="Product - SKU definition" subtitle="Manage SKU definition rules, lifecycle, and locale translations for CPQ canonical options.">
      <div className="skuPage">
        <div className="skuSectionTabs" role="tablist" aria-label="SKU definition sections">
          <button className={activeSection === 'rules' ? 'isActive' : ''} onClick={() => setActiveSection('rules')}>Rules</button>
          <button className={activeSection === 'translations' ? 'isActive' : ''} onClick={() => setActiveSection('translations')}>Translations</button>
        </div>

        {activeSection === 'rules' ? (
          <>
            <div className="summaryChips compactSummaryRow" aria-label="Rules summary">
              <span className="summaryChip">Total rules: {statusSummary.total}</span>
              <span className="summaryChip active">Active: {statusSummary.active}</span>
              <span className="summaryChip inactive">Inactive: {statusSummary.inactive}</span>
              <span className="subtle">{status}</span>
            </div>

            <div className="note compactNote">
              Digit is structurally tied to one option name across all rows (active + inactive). Code values are case-insensitive and normalized to uppercase.
            </div>

            {digitIssues.length ? (
              <div className="card alertCard">
                <div style={{ fontWeight: 700 }}>Data issue found</div>
                <div>Some digits are mapped to multiple option names and need cleanup:</div>
                <ul>
                  {digitIssues.map((issue) => (
                    <li key={issue.digit_position}>
                      Digit {issue.digit_position}: {issue.option_names.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="card addRuleCard compactCard">
              <div className="cardHeader">
                <div>
                  <h3>Add SKU rule</h3>
                  <p className="subtle">Fields marked * are required.</p>
                </div>
              </div>
              <div className="addRuleGrid">
                <label>
                  Digit *
                  <input type="number" min={1} disabled={!canManage} value={form.digit_position} onChange={(e) => setForm((v) => ({ ...v, digit_position: Number(e.target.value) }))} />
                </label>
                <label>
                  Option *
                  <input
                    placeholder="Option name"
                    disabled={!canManage || !!knownDigitOptionName}
                    value={form.option_name}
                    onChange={(e) => setForm((v) => ({ ...v, option_name: e.target.value }))}
                  />
                </label>
                <label>
                  Code *
                  <input
                    placeholder="Single character"
                    maxLength={1}
                    disabled={!canManage}
                    value={form.code_value}
                    onChange={(e) => setForm((v) => ({ ...v, code_value: e.target.value.toUpperCase() }))}
                  />
                </label>
                <label>
                  Choice *
                  <input placeholder="Choice" disabled={!canManage} value={form.choice_value} onChange={(e) => setForm((v) => ({ ...v, choice_value: e.target.value }))} />
                </label>
                <label className="wideField">
                  Description element
                  <input
                    placeholder="Description element"
                    disabled={!canManage}
                    value={form.description_element}
                    onChange={(e) => setForm((v) => ({ ...v, description_element: e.target.value }))}
                  />
                </label>
                <div className="addRuleActions">
                  <button className="primary" disabled={!canManage} onClick={addRule}>
                    Add rule
                  </button>
                </div>
              </div>
              {knownDigitOptionName ? <div className="subtle">Digit {form.digit_position} already uses option “{knownDigitOptionName}”; option is locked.</div> : null}
            </div>

            <div className="tableViewport">
              <div className="tableToolbar compactToolbar">
                <input
                  placeholder="Search digit, option, code, choice, reason..."
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                />
                <select value={filters.status} onChange={(e) => updateFilter('status', e.target.value as RuleFilters['status'])}>
                  <option value="all">All statuses</option>
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                </select>
                <button onClick={resetFilters}>Reset filters</button>
              </div>

              <div className="tableWrap skuTableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Digit</th>
                      <th>Option</th>
                      <th>Code</th>
                      <th>Choice</th>
                      <th>Status</th>
                      <th>Last edited by</th>
                      <th>Last edited at</th>
                      <th>Deactivated at</th>
                      <th>Reason</th>
                      <th>Action</th>
                    </tr>
                    <tr className="filterRow">
                      <th>
                        <input placeholder="Filter" value={filters.digit} onChange={(e) => updateFilter('digit', e.target.value)} />
                      </th>
                      <th>
                        <input placeholder="Filter" value={filters.option} onChange={(e) => updateFilter('option', e.target.value)} />
                      </th>
                      <th>
                        <input placeholder="Filter" value={filters.code} onChange={(e) => updateFilter('code', e.target.value.toUpperCase())} />
                      </th>
                      <th>
                        <input placeholder="Filter" value={filters.choice} onChange={(e) => updateFilter('choice', e.target.value)} />
                      </th>
                      <th>
                        <select value={filters.status} onChange={(e) => updateFilter('status', e.target.value as RuleFilters['status'])}>
                          <option value="all">All</option>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </th>
                      <th />
                      <th />
                      <th />
                      <th>
                        <input placeholder="Filter" value={filters.reason} onChange={(e) => updateFilter('reason', e.target.value)} />
                      </th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRules.map((rule) => (
                      <tr key={rule.id} className={rule.is_active ? '' : 'inactiveRow'}>
                        <td className="emphasis">{rule.digit_position}</td>
                        <td className="emphasis">{rule.option_name}</td>
                        <td className="codeCell">{rule.code_value}</td>
                        <td>{rule.choice_value}</td>
                        <td>
                          <span className={`statusBadge ${rule.is_active ? 'active' : 'inactive'}`}>{rule.is_active ? 'Active' : 'Inactive'}</span>
                        </td>
                        <td className="secondaryText">{rule.last_edited_by_email || '-'}</td>
                        <td className="secondaryText">{rule.last_edited_at || '-'}</td>
                        <td className="secondaryText">{rule.deactivated_at || '-'}</td>
                        <td className="secondaryText">{rule.deactivation_reason || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button disabled={!canManage} onClick={() => { setPendingEdit(rule); setEditChoiceValue(rule.choice_value); setEditDescriptionElement(rule.description_element || ''); }}>Edit</button>
                            <button
                              className={rule.is_active ? 'dangerAction' : 'successAction'}
                              disabled={!canManage}
                              onClick={() => {
                                if (rule.is_active) {
                                  setPendingDeactivate(rule);
                                  setDeactivationReason('');
                                  return;
                                }
                                toggleActive(rule);
                              }}
                            >
                              {getRuleActionLabel(rule)}
                            </button>
                            {canDelete ? <button className="dangerAction" onClick={() => setPendingDelete(rule)}>Delete permanently</button> : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="summaryChips compactSummaryRow" aria-label="Translations summary">
              <span className="summaryChip">Rows in scope: {translationSummary.total}</span>
              <span className="summaryChip active">Completed: {translationSummary.completed}</span>
              <span className="summaryChip inactive">Missing: {translationSummary.missing}</span>
              <span className="summaryChip">Unsaved edits: {translationSummary.dirty}</span>
              <span className="subtle">{translationStatus}</span>
            </div>

            <div className="note compactNote">
              Translations are locale-specific overrides for canonical CPQ option choices. If a translation is blank, canonical choice text is the fallback.
            </div>

            <div className="card compactCard translationCard">
              <div className="tableToolbar compactToolbar">
                <label>
                  Locale
                  <select
                    value={translationLocale}
                    onChange={async (e) => {
                      const nextLocale = e.target.value;
                      setTranslationLocale(nextLocale);
                      await loadTranslations(nextLocale, translationIncludeInactive);
                    }}
                  >
                    {translationLocales.map((locale) => <option key={locale} value={locale}>{locale}</option>)}
                  </select>
                </label>
                <input
                  placeholder="Search digit, option, code, canonical choice, translation..."
                  value={translationSearch}
                  onChange={(e) => setTranslationSearch(e.target.value)}
                />
                <label className="checkboxLabel">
                  <input
                    type="checkbox"
                    checked={translationIncludeInactive}
                    onChange={async (e) => {
                      const nextValue = e.target.checked;
                      setTranslationIncludeInactive(nextValue);
                      await loadTranslations(translationLocale, nextValue);
                    }}
                  />
                  Include inactive rows
                </label>
                <button disabled={translationSaving || !translationSummary.dirty || !canManage} className="primary" onClick={saveTranslations}>Save translations</button>
              </div>

              <div className="tableWrap skuTableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Digit</th>
                      <th>Option</th>
                      <th>Code</th>
                      <th>Canonical choice</th>
                      <th>Translated value ({translationLocale})</th>
                      <th>Translation status</th>
                      <th>Updated by</th>
                      <th>Updated at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTranslationRows.map((row) => {
                      const draftValue = Object.prototype.hasOwnProperty.call(translationDrafts, row.cpq_import_row_id)
                        ? translationDrafts[row.cpq_import_row_id]
                        : row.translated_value || '';
                      const hasValue = !!String(draftValue || '').trim();
                      const dirty = Object.prototype.hasOwnProperty.call(translationDrafts, row.cpq_import_row_id);
                      return (
                        <tr key={row.cpq_import_row_id} className={row.is_active ? '' : 'inactiveRow'}>
                          <td className="emphasis">{row.digit_position}</td>
                          <td className="emphasis">{row.option_name}</td>
                          <td className="codeCell">{row.code_value}</td>
                          <td>{row.choice_value}</td>
                          <td>
                            <input
                              placeholder="Enter translation"
                              value={draftValue}
                              disabled={!canManage}
                              onChange={(e) => updateTranslationDraft(row.cpq_import_row_id, e.target.value)}
                            />
                          </td>
                          <td>
                            <span className={`statusBadge ${hasValue ? 'active' : 'inactive'}`}>{hasValue ? 'Translated' : 'Missing'}</span>
                            {dirty ? <span className="subtle"> · unsaved</span> : null}
                          </td>
                          <td className="secondaryText">{row.translation_updated_by_email || '-'}</td>
                          <td className="secondaryText">{row.translation_updated_at || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {pendingEdit ? (
          <div className="modalBackdrop">
            <div className="modalCard deactivateModal">
              <h3>Edit SKU rule</h3>
              <p className="subtle">Changes are captured in the audit trail with user email and timestamp.</p>
              <label className="modalLabel">
                Choice *
                <input value={editChoiceValue} onChange={(e) => setEditChoiceValue(e.target.value)} />
              </label>
              <label className="modalLabel">
                Description element
                <textarea rows={3} value={editDescriptionElement} onChange={(e) => setEditDescriptionElement(e.target.value)} />
              </label>
              <div className="modalActions">
                <button onClick={() => setPendingEdit(null)}>Cancel</button>
                <button className="primary" disabled={!editChoiceValue.trim()} onClick={saveEdit}>Save edit</button>
              </div>
            </div>
          </div>
        ) : null}

        {pendingDeactivate ? (
          <div className="modalBackdrop">
            <div className="modalCard deactivateModal">
              <h3>Deactivate rule</h3>
              <p className="subtle">Please provide a reason. This will be saved to the audit trail for inactive rules.</p>
              <div className="card" style={{ marginBottom: 12 }}>
                <strong>
                  Digit {pendingDeactivate.digit_position} · {pendingDeactivate.option_name} · {pendingDeactivate.code_value} · {pendingDeactivate.choice_value}
                </strong>
              </div>
              <label className="modalLabel">
                Deactivation reason *
                <textarea
                  rows={3}
                  value={deactivationReason}
                  onChange={(e) => setDeactivationReason(e.target.value)}
                  placeholder="Why should this rule be deactivated?"
                />
              </label>
              <div className="modalActions">
                <button onClick={() => setPendingDeactivate(null)}>Cancel</button>
                <button className="primary" disabled={!deactivationReason.trim()} onClick={() => toggleActive(pendingDeactivate, deactivationReason.trim())}>
                  Confirm deactivation
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {pendingDelete ? (
          <div className="modalBackdrop">
            <div className="modalCard deactivateModal">
              <h3>Permanent delete SKU rule</h3>
              <p className="subtle">This action permanently removes the row from the database and cannot be undone.</p>
              <div className="card" style={{ marginBottom: 12 }}>
                <strong>
                  Digit {pendingDelete.digit_position} · {pendingDelete.option_name} · {pendingDelete.code_value} · {pendingDelete.choice_value}
                </strong>
              </div>
              <div className="modalActions">
                <button onClick={() => setPendingDelete(null)}>Cancel</button>
                <button className="dangerAction" onClick={() => deleteRule(pendingDelete)}>Delete permanently</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AdminPageShell>
  );
}
