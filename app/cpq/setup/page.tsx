'use client';

import { useEffect, useMemo, useState } from 'react';

type AccountContext = {
  id: number;
  account_code: string;
  customer_id: string;
  currency: string;
  language: string;
  country_code: string;
  is_active: boolean;
};

type Ruleset = {
  id: number;
  cpq_ruleset: string;
  description: string | null;
  bike_type: string | null;
  namespace: string;
  header_id: string;
  sort_order: number;
  is_active: boolean;
};

type TabKey = 'accounts' | 'rulesets';

const emptyAccount: Omit<AccountContext, 'id'> = {
  account_code: '',
  customer_id: '',
  currency: 'GBP',
  language: 'en-GB',
  country_code: 'GB',
  is_active: true,
};

const emptyRuleset: Omit<Ruleset, 'id'> = {
  cpq_ruleset: '',
  description: '',
  bike_type: '',
  namespace: 'Default',
  header_id: 'Simulator',
  sort_order: 0,
  is_active: true,
};

export default function CpqSetupPage() {
  const [tab, setTab] = useState<TabKey>('accounts');
  const [accounts, setAccounts] = useState<AccountContext[]>([]);
  const [rulesets, setRulesets] = useState<Ruleset[]>([]);
  const [accountDraft, setAccountDraft] = useState(emptyAccount);
  const [rulesetDraft, setRulesetDraft] = useState(emptyRuleset);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [editingRulesetId, setEditingRulesetId] = useState<number | null>(null);
  const [status, setStatus] = useState('');

  const canSubmitAccount = useMemo(
    () =>
      !!accountDraft.account_code.trim() &&
      !!accountDraft.customer_id.trim() &&
      !!accountDraft.currency.trim() &&
      !!accountDraft.language.trim() &&
      /^[A-Za-z]{2}$/.test(accountDraft.country_code.trim()),
    [accountDraft],
  );

  const canSubmitRuleset = useMemo(() => !!rulesetDraft.cpq_ruleset.trim() && !!rulesetDraft.namespace.trim() && !!rulesetDraft.header_id.trim(), [rulesetDraft]);

  const load = async () => {
    const [accountRes, rulesetRes] = await Promise.all([
      fetch('/api/cpq/setup/account-context'),
      fetch('/api/cpq/setup/rulesets'),
    ]);

    const accountPayload = await accountRes.json().catch(() => ({ rows: [] }));
    const rulesetPayload = await rulesetRes.json().catch(() => ({ rows: [] }));

    setAccounts(accountPayload.rows || []);
    setRulesets(rulesetPayload.rows || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const resetAccountDraft = () => {
    setEditingAccountId(null);
    setAccountDraft(emptyAccount);
  };

  const resetRulesetDraft = () => {
    setEditingRulesetId(null);
    setRulesetDraft(emptyRuleset);
  };

  const saveAccount = async () => {
    if (!canSubmitAccount) {
      setStatus('Account code, customer ID, currency, language, and 2-letter country code are required.');
      return;
    }

    const isEdit = Number.isFinite(editingAccountId);
    const url = isEdit ? `/api/cpq/setup/account-context/${editingAccountId}` : '/api/cpq/setup/account-context';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accountDraft),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(payload.error || 'Failed to save account context');
      return;
    }

    setStatus(isEdit ? 'Account context updated.' : 'Account context created.');
    resetAccountDraft();
    await load();
  };

  const deleteAccount = async (id: number) => {
    if (!window.confirm('Delete this account context?')) return;

    const res = await fetch(`/api/cpq/setup/account-context/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setStatus('Failed to delete account context');
      return;
    }

    if (editingAccountId === id) resetAccountDraft();
    setStatus('Account context deleted.');
    await load();
  };

  const saveRuleset = async () => {
    if (!canSubmitRuleset) {
      setStatus('Ruleset, namespace, and header ID are required.');
      return;
    }

    const isEdit = Number.isFinite(editingRulesetId);
    const url = isEdit ? `/api/cpq/setup/rulesets/${editingRulesetId}` : '/api/cpq/setup/rulesets';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rulesetDraft),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(payload.error || 'Failed to save ruleset');
      return;
    }

    setStatus(isEdit ? 'Ruleset updated.' : 'Ruleset created.');
    resetRulesetDraft();
    await load();
  };

  const deleteRuleset = async (id: number) => {
    if (!window.confirm('Delete this ruleset?')) return;

    const res = await fetch(`/api/cpq/setup/rulesets/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setStatus('Failed to delete ruleset');
      return;
    }

    if (editingRulesetId === id) resetRulesetDraft();
    setStatus('Ruleset deleted.');
    await load();
  };

  return (
    <main className="pageRoot">
      <section className="pageHeader compactCard">
        <h1>CPQ Setup</h1>
        <p>Manage account context defaults and CPQ rulesets stored in Neon.</p>
        <div className="tabRow">
          <button className={tab === 'accounts' ? 'primary' : ''} onClick={() => setTab('accounts')}>Account code management</button>
          <button className={tab === 'rulesets' ? 'primary' : ''} onClick={() => setTab('rulesets')}>Ruleset management</button>
        </div>
        {status && <div className="note compactNote">{status}</div>}
      </section>

      {tab === 'accounts' && (
        <section className="compactCard compactSection">
          <div className="filtersHeader">
            <strong>{editingAccountId ? 'Edit account context' : 'Add account context'}</strong>
            {editingAccountId && <button onClick={resetAccountDraft}>Cancel edit</button>}
          </div>
          <div className="denseGrid4">
            <label>Account code<input value={accountDraft.account_code} onChange={(e) => setAccountDraft((prev) => ({ ...prev, account_code: e.target.value }))} /></label>
            <label>Customer ID<input value={accountDraft.customer_id} onChange={(e) => setAccountDraft((prev) => ({ ...prev, customer_id: e.target.value }))} /></label>
            <label>Currency<input value={accountDraft.currency} onChange={(e) => setAccountDraft((prev) => ({ ...prev, currency: e.target.value }))} /></label>
            <label>Language<input value={accountDraft.language} onChange={(e) => setAccountDraft((prev) => ({ ...prev, language: e.target.value }))} /></label>
            <label>Country code
              <input
                value={accountDraft.country_code}
                maxLength={2}
                onChange={(e) => setAccountDraft((prev) => ({ ...prev, country_code: e.target.value.toUpperCase() }))}
              />
            </label>
          </div>
          <label className="inlineCheck"><input type="checkbox" checked={accountDraft.is_active} onChange={(e) => setAccountDraft((prev) => ({ ...prev, is_active: e.target.checked }))} /> Active</label>
          <div className="toolbar compactToolbar">
            <button className="primary" onClick={saveAccount}>{editingAccountId ? 'Update account context' : 'Create account context'}</button>
          </div>

          <div className="tableWrap" style={{ maxHeight: 420 }}>
            <table>
              <thead>
                <tr><th>Account</th><th>Customer ID</th><th>Currency</th><th>Language</th><th>Country</th><th>Active</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {accounts.map((row) => (
                  <tr key={row.id}>
                    <td>{row.account_code}</td>
                    <td>{row.customer_id}</td>
                    <td>{row.currency}</td>
                    <td>{row.language}</td>
                    <td>{row.country_code}</td>
                    <td>{row.is_active ? 'Yes' : 'No'}</td>
                    <td>
                      <div className="rowButtons">
                        <button onClick={() => { setEditingAccountId(row.id); setAccountDraft({ account_code: row.account_code, customer_id: row.customer_id, currency: row.currency, language: row.language, country_code: row.country_code, is_active: row.is_active }); }}>Edit</button>
                        <button onClick={() => void deleteAccount(row.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'rulesets' && (
        <section className="compactCard compactSection">
          <div className="filtersHeader">
            <strong>{editingRulesetId ? 'Edit ruleset' : 'Add ruleset'}</strong>
            {editingRulesetId && <button onClick={resetRulesetDraft}>Cancel edit</button>}
          </div>
          <div className="denseGrid4">
            <label>CPQ ruleset<input value={rulesetDraft.cpq_ruleset} onChange={(e) => setRulesetDraft((prev) => ({ ...prev, cpq_ruleset: e.target.value }))} /></label>
            <label>Description<input value={rulesetDraft.description ?? ''} onChange={(e) => setRulesetDraft((prev) => ({ ...prev, description: e.target.value }))} /></label>
            <label>Bike type<input value={rulesetDraft.bike_type ?? ''} onChange={(e) => setRulesetDraft((prev) => ({ ...prev, bike_type: e.target.value }))} /></label>
            <label>Namespace<input value={rulesetDraft.namespace} onChange={(e) => setRulesetDraft((prev) => ({ ...prev, namespace: e.target.value }))} /></label>
            <label>Header ID<input value={rulesetDraft.header_id} onChange={(e) => setRulesetDraft((prev) => ({ ...prev, header_id: e.target.value }))} /></label>
            <label>Sort order<input type="number" value={rulesetDraft.sort_order} onChange={(e) => setRulesetDraft((prev) => ({ ...prev, sort_order: Number(e.target.value) || 0 }))} /></label>
          </div>
          <label className="inlineCheck"><input type="checkbox" checked={rulesetDraft.is_active} onChange={(e) => setRulesetDraft((prev) => ({ ...prev, is_active: e.target.checked }))} /> Active</label>
          <div className="toolbar compactToolbar">
            <button className="primary" onClick={saveRuleset}>{editingRulesetId ? 'Update ruleset' : 'Create ruleset'}</button>
          </div>

          <div className="tableWrap" style={{ maxHeight: 420 }}>
            <table>
              <thead>
                <tr><th>Ruleset</th><th>Namespace</th><th>Header ID</th><th>Sort</th><th>Bike type</th><th>Active</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {rulesets.map((row) => (
                  <tr key={row.id}>
                    <td>{row.cpq_ruleset}</td>
                    <td>{row.namespace}</td>
                    <td>{row.header_id}</td>
                    <td>{row.sort_order}</td>
                    <td>{row.bike_type ?? '-'}</td>
                    <td>{row.is_active ? 'Yes' : 'No'}</td>
                    <td>
                      <div className="rowButtons">
                        <button onClick={() => {
                          setEditingRulesetId(row.id);
                          setRulesetDraft({
                            cpq_ruleset: row.cpq_ruleset,
                            description: row.description ?? '',
                            bike_type: row.bike_type ?? '',
                            namespace: row.namespace,
                            header_id: row.header_id,
                            sort_order: row.sort_order,
                            is_active: row.is_active,
                          });
                        }}>Edit</button>
                        <button onClick={() => void deleteRuleset(row.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
