'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AdminPageShell from '@/components/admin/admin-page-shell';
import { CATALOGUE_CATEGORIES, type BikeSkuCard, type CatalogueCategory, type FeatureField, type NormalizedState } from '@/lib/cpq-integration/contracts';

type CatalogueResponse = {
  ok: boolean;
  mock?: boolean;
  cards: BikeSkuCard[];
  error?: string;
  errors?: string[];
};

type StartOrConfigureResponse = {
  ok: boolean;
  mock?: boolean;
  state?: NormalizedState;
  error?: string;
};

const CATEGORY_LABELS: Record<CatalogueCategory, string> = {
  'all-bikes': 'All bikes',
  'c-line': 'C line',
  'p-line': 'P line',
  'g-line': 'G line',
  't-line': 'T line',
  'special-editions': 'Special editions',
  electric: 'Electric',
  'electric-c-line': 'Electric C line',
  'electric-p-line': 'Electric P line',
  'electric-g-line': 'Electric G line',
  'electric-t-line': 'Electric T line'
};

function formatMoney(amount: number | null | undefined, currencyCode = 'GBP') {
  if (amount == null || Number.isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currencyCode }).format(amount);
}

function SummaryCard({ state, mock }: { state: NormalizedState | null; mock: boolean }) {
  if (!state) return null;
  return (
    <div className="card compactCard compactSection">
      <div className="filtersHeader"><strong>Current configuration</strong>{mock ? <span className="subtle">Mock mode</span> : null}</div>
      <div className="matrixFilterGrid featureFilterGrid">
        <label className="filterLabel">Description
          <input readOnly value={state.productDescription || '—'} />
        </label>
        <label className="filterLabel">Product code
          <input readOnly value={state.productCode || '—'} />
        </label>
        <label className="filterLabel">Trade
          <input readOnly value={formatMoney(state.tradePrice ?? state.configuredPrice, state.currencyCode)} />
        </label>
        <label className="filterLabel">MSRP
          <input readOnly value={formatMoney(state.msrp, state.currencyCode)} />
        </label>
      </div>
    </div>
  );
}

export default function CpqPageClient() {
  const [category, setCategory] = useState<CatalogueCategory>('all-bikes');
  const [cards, setCards] = useState<BikeSkuCard[]>([]);
  const [catalogueError, setCatalogueError] = useState('');
  const [catalogueWarnings, setCatalogueWarnings] = useState<string[]>([]);
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);
  const [selectedCard, setSelectedCard] = useState<BikeSkuCard | null>(null);
  const [state, setState] = useState<NormalizedState | null>(null);
  const [builderError, setBuilderError] = useState('');
  const [isLoadingBuilder, setIsLoadingBuilder] = useState(false);
  const [isMock, setIsMock] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [status, setStatus] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Array<{ id: string; value: string }>>([]);

  async function loadCatalogue(nextCategory: CatalogueCategory) {
    setLoadingCatalogue(true);
    setCatalogueError('');
    const res = await fetch(`/api/cpq/catalogue?category=${encodeURIComponent(nextCategory)}`);
    const payload = await res.json().catch(() => ({})) as CatalogueResponse;
    if (!res.ok || !payload.ok) {
      setCards([]);
      setCatalogueError(payload.error || 'Failed to load catalogue');
      setCatalogueWarnings(payload.errors || []);
      setLoadingCatalogue(false);
      return;
    }
    setCards(payload.cards || []);
    setCatalogueWarnings(payload.errors || []);
    setCatalogueError('');
    setLoadingCatalogue(false);
  }

  useEffect(() => {
    void loadCatalogue(category);
  }, [category]);

  async function startConfiguration(card: BikeSkuCard) {
    setSelectedCard(card);
    setBuilderError('');
    setStatus('');
    setIsLoadingBuilder(true);
    const res = await fetch('/api/cpq/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partName: card.configureQuery.ruleset,
        partNamespace: card.configureQuery.namespace,
        headerId: card.configureQuery.headerId,
        variantKey: card.configureQuery.variantKey
      })
    });

    const payload = await res.json().catch(() => ({})) as StartOrConfigureResponse;
    if (!res.ok || !payload.ok || !payload.state) {
      setBuilderError(payload.error || 'Failed to start configuration');
      setState(null);
      setIsLoadingBuilder(false);
      return;
    }

    setState(payload.state);
    setIsMock(Boolean(payload.mock));
    setIsLoadingBuilder(false);
  }

  function queueSelection(optionId: string, value: string) {
    setState((current) => {
      if (!current) return current;
      return {
        ...current,
        features: current.features.map((feature) => {
          if (feature.cpqOptionId !== optionId) return feature;
          const picked = feature.options.find((option) => option.value === value);
          return { ...feature, selectedValue: value, selectedCaption: picked?.caption || value };
        })
      };
    });

    pendingRef.current = [...pendingRef.current.filter((selection) => selection.id !== optionId), { id: optionId, value }];
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const selections = [...pendingRef.current];
      pendingRef.current = [];
      if (!selections.length) return;
      const res = await fetch('/api/cpq/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections, clientRequestId: crypto.randomUUID() })
      });
      const payload = await res.json().catch(() => ({})) as StartOrConfigureResponse;
      if (!res.ok || !payload.ok || !payload.state) {
        setBuilderError(payload.error || 'Failed to update configuration');
        return;
      }
      setState(payload.state);
      setIsMock(Boolean(payload.mock));
    }, 280);
  }

  async function resetBuilder() {
    if (!selectedCard) return;
    await fetch('/api/cpq/reset', { method: 'POST' });
    await startConfiguration(selectedCard);
  }

  async function finalizeBuilder() {
    setIsFinalizing(true);
    setStatus('');
    const res = await fetch('/api/cpq/finalize', { method: 'POST' });
    const payload = await res.json().catch(() => ({})) as { ok?: boolean; message?: string; error?: string; mock?: boolean };
    if (!res.ok || !payload.ok) {
      setStatus(payload.error || 'Finalize failed');
      setIsFinalizing(false);
      return;
    }
    setStatus(payload.mock ? 'Finalized in mock mode.' : 'Configuration finalized.');
    setIsFinalizing(false);
  }

  const visibleFeatures = useMemo(() => (state?.features || []).filter((feature) => feature.isVisible), [state]);

  return (
    <AdminPageShell title="Product - CPQ" subtitle="Catalogue and configurator flow migrated from the CPQ POC into AppBikeConfig.">
      <div className="card compactCard compactSection">
        <div className="filtersHeader"><strong>Catalogue</strong></div>
        <div className="toolbar compactToolbar">
          <label className="filterLabel">Category
            <select value={category} onChange={(event) => setCategory(event.target.value as CatalogueCategory)}>
              {CATALOGUE_CATEGORIES.map((item) => <option key={item} value={item}>{CATEGORY_LABELS[item]}</option>)}
            </select>
          </label>
          <button onClick={() => void loadCatalogue(category)}>{loadingCatalogue ? 'Loading…' : 'Refresh'}</button>
        </div>
        {catalogueError ? <div className="note compactNote">{catalogueError}</div> : null}
        {catalogueWarnings.length ? <div className="note compactNote">Warnings: {catalogueWarnings.join(' · ')}</div> : null}
        <div className="tableWrap" style={{ maxHeight: 360 }}>
          <table>
            <thead><tr><th>Title</th><th>Family</th><th>Trade</th><th>MSRP</th><th>Ruleset</th><th /></tr></thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.id}>
                  <td>{card.title}</td>
                  <td>{card.familyLabel}{card.isElectric ? ' · Electric' : ''}</td>
                  <td>{formatMoney(card.tradePrice, card.currencyCode)}</td>
                  <td>{formatMoney(card.msrp, card.currencyCode)}</td>
                  <td>{card.configureQuery.ruleset}</td>
                  <td><button className="primary" onClick={() => void startConfiguration(card)}>Configure</button></td>
                </tr>
              ))}
              {!cards.length ? <tr><td colSpan={6} className="subtle">No cards for this category.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      <SummaryCard state={state} mock={isMock} />

      <div className="card compactCard compactSection">
        <div className="filtersHeader"><strong>Configurator</strong>
          <div className="toolbar compactToolbar" style={{ margin: 0 }}>
            <button disabled={!selectedCard || isLoadingBuilder} onClick={() => void resetBuilder()}>Reset</button>
            <button className="primary" disabled={!state || isFinalizing} onClick={() => void finalizeBuilder()}>{isFinalizing ? 'Finalizing…' : 'Finalize'}</button>
          </div>
        </div>
        {!selectedCard ? <div className="subtle">Pick a catalogue row and click Configure.</div> : null}
        {isLoadingBuilder ? <div className="subtle">Loading configuration…</div> : null}
        {builderError ? <div className="note compactNote">{builderError}</div> : null}
        {status ? <div className="note compactNote">{status}</div> : null}

        {state ? (
          <div className="matrixFilterGrid featureFilterGrid">
            {visibleFeatures.map((feature: FeatureField) => (
              <label key={feature.featureKey} className="filterLabel">
                {feature.label}
                <select value={feature.selectedValue} onChange={(event) => queueSelection(feature.cpqOptionId, event.target.value)} disabled={!feature.isEnabled}>
                  {feature.options.map((option) => <option key={`${feature.featureKey}-${option.optionId || option.value}`} value={option.value}>{option.caption}</option>)}
                </select>
              </label>
            ))}
          </div>
        ) : null}
      </div>
    </AdminPageShell>
  );
}
