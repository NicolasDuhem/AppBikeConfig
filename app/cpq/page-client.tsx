'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './page-client.module.css';
import {
  type BikeSkuCard,
  type CatalogueCategory,
  type ConfigurationVariantCard,
  type FeatureField,
  isCatalogueCategory,
  type NormalizedState
} from '@/lib/cpq-integration/contracts';

type View = 'home' | 'categories' | 'catalogue' | 'variants' | 'configure';

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

type ConfigurationVariantsResponse = {
  ok: boolean;
  mock?: boolean;
  bikeTypeId: string;
  variants: ConfigurationVariantCard[];
  nextCursor: string | null;
  totalVariantKeys: number;
  errors?: string[];
  error?: string;
};

const CATEGORY_LABELS: Record<CatalogueCategory, string> = {
  'all-bikes': 'All bikes',
  'c-line': 'C Line',
  'p-line': 'P Line',
  'g-line': 'G Line',
  't-line': 'T Line',
  'special-editions': 'Special editions',
  electric: 'Electric bikes',
  'electric-c-line': 'C Line electric',
  'electric-p-line': 'P Line electric',
  'electric-g-line': 'G Line electric',
  'electric-t-line': 'T Line electric'
};

const PAGE_LIMIT = 8;

function formatMoney(amount: number | null | undefined, currencyCode = 'GBP') {
  if (amount == null || Number.isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currencyCode }).format(amount);
}

function heading(text: string) {
  return <h1 className={styles.heroTitle}>{text}</h1>;
}

export default function CpqPageClient() {
  const [view, setView] = useState<View>('home');
  const [category, setCategory] = useState<CatalogueCategory>('all-bikes');
  const [cards, setCards] = useState<BikeSkuCard[]>([]);
  const [catalogueError, setCatalogueError] = useState('');
  const [catalogueWarnings, setCatalogueWarnings] = useState<string[]>([]);
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);
  const [catalogueMock, setCatalogueMock] = useState(false);

  const [variants, setVariants] = useState<ConfigurationVariantCard[]>([]);
  const [variantsError, setVariantsError] = useState('');
  const [variantsWarnings, setVariantsWarnings] = useState<string[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [loadingMoreVariants, setLoadingMoreVariants] = useState(false);
  const [variantsMock, setVariantsMock] = useState(false);
  const [variantBikeTypeId, setVariantBikeTypeId] = useState('');
  const [variantCursor, setVariantCursor] = useState<string | null>(null);
  const [variantTotalKeys, setVariantTotalKeys] = useState<number | null>(null);

  const [selectedCard, setSelectedCard] = useState<BikeSkuCard | ConfigurationVariantCard | null>(null);
  const [state, setState] = useState<NormalizedState | null>(null);
  const [builderError, setBuilderError] = useState('');
  const [isLoadingBuilder, setIsLoadingBuilder] = useState(false);
  const [isMock, setIsMock] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [status, setStatus] = useState('');
  const [isReviewRefreshing, setIsReviewRefreshing] = useState(false);
  const [isOptionsRefreshing, setIsOptionsRefreshing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Array<{ id: string; value: string }>>([]);

  const visibleFeatures = useMemo(() => (state?.features || []).filter((feature) => feature.isVisible), [state]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextView = params.get('view');
    const nextCategory = params.get('category');
    const ruleset = params.get('ruleset')?.trim();
    const namespace = params.get('namespace')?.trim();
    const headerId = params.get('headerId')?.trim();
    const variantKey = params.get('variantKey')?.trim();
    const detailId = params.get('detailId')?.trim();

    if (nextCategory && isCatalogueCategory(nextCategory)) {
      setCategory(nextCategory);
    }

    if (nextView === 'catalogue' && nextCategory && isCatalogueCategory(nextCategory)) {
      setView('catalogue');
      return;
    }

    if (nextView === 'variants' && params.get('bikeTypeId')) {
      const bikeTypeId = params.get('bikeTypeId') || '';
      setView('variants');
      setVariantBikeTypeId(bikeTypeId);
      void loadVariants(bikeTypeId, true);
      return;
    }

    if (nextView === 'configure' || (ruleset && namespace && headerId)) {
      const cardLike: BikeSkuCard = {
        id: `deep-link-${ruleset || 'default'}`,
        bikeTypeId: params.get('bikeTypeId') || 'unknown',
        title: 'Deep link configuration',
        modelCode: '',
        familyLabel: '',
        isElectric: false,
        tradePrice: null,
        msrp: null,
        highlights: [],
        configureQuery: {
          ruleset: ruleset || 'BIKE_CUSTOM_USD',
          namespace: namespace || 'Brompton',
          headerId: headerId || 'BROMPTON_USD',
          variantKey: variantKey || undefined
        }
      };
      setView('configure');
      void startConfiguration(cardLike, detailId || undefined);
      return;
    }

    if (nextView === 'categories') {
      setView('categories');
      return;
    }

    setView('home');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view === 'catalogue') {
      void loadCatalogue(category);
    }
  }, [view, category]);

  async function loadCatalogue(nextCategory: CatalogueCategory) {
    setLoadingCatalogue(true);
    setCatalogueError('');
    const res = await fetch(`/api/cpq/catalogue?category=${encodeURIComponent(nextCategory)}`);
    const payload = (await res.json().catch(() => ({}))) as CatalogueResponse;
    if (!res.ok || !payload.ok) {
      setCards([]);
      setCatalogueError(payload.error || 'Failed to load catalogue');
      setCatalogueWarnings(payload.errors || []);
      setLoadingCatalogue(false);
      return;
    }
    setCards(payload.cards || []);
    setCatalogueWarnings(payload.errors || []);
    setCatalogueMock(Boolean(payload.mock));
    setCatalogueError('');
    setLoadingCatalogue(false);
  }

  async function loadVariants(bikeTypeId: string, reset: boolean) {
    const cursor = reset ? null : variantCursor;
    if (reset) {
      setLoadingVariants(true);
      setVariants([]);
      setVariantCursor(null);
      setVariantTotalKeys(null);
      setVariantsWarnings([]);
      setVariantsError('');
    } else {
      setLoadingMoreVariants(true);
    }

    const query = new URLSearchParams({ bikeTypeId, limit: String(PAGE_LIMIT) });
    if (cursor != null) query.set('cursor', cursor);

    const res = await fetch(`/api/cpq/configuration-variants?${query.toString()}`);
    const payload = (await res.json().catch(() => ({}))) as ConfigurationVariantsResponse;

    if (!res.ok || !payload.ok) {
      setVariantsError(payload.error || 'Could not load configuration variants.');
      setLoadingVariants(false);
      setLoadingMoreVariants(false);
      return;
    }

    setVariants((current) => (reset ? payload.variants : [...current, ...payload.variants]));
    setVariantsWarnings(payload.errors || []);
    setVariantsMock(Boolean(payload.mock));
    setVariantCursor(payload.nextCursor);
    setVariantTotalKeys(payload.totalVariantKeys);
    setLoadingVariants(false);
    setLoadingMoreVariants(false);
  }

  function navigate(nextView: View, query?: Record<string, string | undefined>) {
    setView(nextView);
    const params = new URLSearchParams();
    params.set('view', nextView);
    Object.entries(query || {}).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    window.history.replaceState({}, '', `/cpq?${params.toString()}`);
  }

  async function startConfiguration(card: BikeSkuCard | ConfigurationVariantCard, detailId?: string) {
    setSelectedCard(card);
    setBuilderError('');
    setStatus('');
    setIsLoadingBuilder(true);
    setIsReviewRefreshing(false);
    setIsOptionsRefreshing(false);

    const res = await fetch('/api/cpq/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partName: card.configureQuery.ruleset,
        partNamespace: card.configureQuery.namespace,
        headerId: card.configureQuery.headerId,
        variantKey: card.configureQuery.variantKey,
        detailId
      })
    });

    const payload = (await res.json().catch(() => ({}))) as StartOrConfigureResponse;
    if (!res.ok || !payload.ok || !payload.state) {
      setBuilderError(payload.error || 'Failed to start configuration');
      setState(null);
      setIsLoadingBuilder(false);
      return;
    }

    setState(payload.state);
    setIsMock(Boolean(payload.mock));
    setIsLoadingBuilder(false);

    navigate('configure', {
      ruleset: card.configureQuery.ruleset,
      namespace: card.configureQuery.namespace,
      headerId: card.configureQuery.headerId,
      variantKey: card.configureQuery.variantKey,
      detailId
    });
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

      setIsReviewRefreshing(true);
      setIsOptionsRefreshing(true);
      const res = await fetch('/api/cpq/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections, clientRequestId: crypto.randomUUID() })
      });
      const payload = (await res.json().catch(() => ({}))) as StartOrConfigureResponse;
      if (!res.ok || !payload.ok || !payload.state) {
        setBuilderError(payload.error || 'Failed to update configuration');
        setIsReviewRefreshing(false);
        setIsOptionsRefreshing(false);
        return;
      }
      setState(payload.state);
      setIsMock(Boolean(payload.mock));
      setIsReviewRefreshing(false);
      setIsOptionsRefreshing(false);
    }, 280);
  }

  async function resetBuilder() {
    if (!selectedCard) return;
    await fetch('/api/cpq/reset', { method: 'POST' });
    const detailId = 'cpqDetailId' in selectedCard ? selectedCard.cpqDetailId : undefined;
    await startConfiguration(selectedCard, detailId);
  }

  async function finalizeBuilder(label: string) {
    setIsFinalizing(true);
    setStatus('');
    const res = await fetch('/api/cpq/finalize', { method: 'POST' });
    const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; mock?: boolean };
    if (!res.ok || !payload.ok) {
      setStatus(payload.error || 'Finalize failed');
      setIsFinalizing(false);
      return;
    }

    setStatus(payload.mock ? `${label}: finalized in mock mode.` : `${label}: configuration finalized.`);
    setIsFinalizing(false);
  }

  const columns = [
    {
      title: 'Bikes',
      links: [
        { label: 'See all bikes', category: 'all-bikes' },
        { label: 'C Line', category: 'c-line' },
        { label: 'P Line', category: 'p-line' },
        { label: 'G Line', category: 'g-line' },
        { label: 'T Line', category: 't-line' },
        { label: 'Special editions', category: 'special-editions' }
      ]
    },
    {
      title: 'Electric',
      links: [
        { label: 'See all electric bikes', category: 'electric' },
        { label: 'C Line electric', category: 'electric-c-line' },
        { label: 'P Line electric', category: 'electric-p-line' },
        { label: 'G Line electric', category: 'electric-g-line' },
        { label: 'T Line electric', category: 'electric-t-line' }
      ]
    }
  ] as const;

  function breadcrumb() {
    const items: string[] = ['Home'];
    if (view === 'categories' || view === 'catalogue' || view === 'variants') items.push('Catalogue');
    if (view === 'catalogue') items.push(CATEGORY_LABELS[category]);
    if (view === 'variants') items.push('Variants');
    if (view === 'configure') items.push('Configure');
    return (
      <ol className={styles.breadcrumb}>
        {items.map((item, i) => (
          <li key={`${item}-${i}`}>{item}{i < items.length - 1 ? ' /' : ''}</li>
        ))}
      </ol>
    );
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <button type="button" className={styles.brand} onClick={() => navigate('home')}>BROMPTON</button>
        <nav className={styles.nav}>
          <button type="button" className={styles.navLink} onClick={() => navigate('categories')}>Catalogue</button>
          <button type="button" className={styles.navLink} onClick={() => navigate('configure')}>Configure</button>
          <span className={styles.navMuted}>Orders</span>
          <span className={styles.navMuted}>Invoices and credits</span>
          <span className={styles.navMuted}>Customer service</span>
          <span className={styles.navMuted}>Assets</span>
        </nav>
      </header>

      <main className={styles.main}>
        {breadcrumb()}

        {view === 'home' ? (
          <section>
            {heading('Brompton Trade')}
            <p className={styles.bodyText}>Browse the catalogue by line, then open Configure to build a bike in CPQ.</p>
            <div className={styles.actionsRow}>
              <button type="button" className={styles.primary} onClick={() => navigate('categories')}>Browse catalogue</button>
              <button type="button" className={styles.secondary} onClick={() => navigate('configure')}>Configure a bike</button>
            </div>
          </section>
        ) : null}

        {view === 'categories' ? (
          <section>
            {heading('Catalogue')}
            <p className={styles.bodyText}>Choose a line to view SKU-style cards. Each card links into Configure with the matching CPQ ruleset context.</p>
            <div className={styles.categoryGrid}>
              {columns.map((col) => (
                <section key={col.title} className={styles.categoryCard}>
                  <h2>{col.title}</h2>
                  <ul>
                    {col.links.map((link) => (
                      <li key={link.category}>
                        <button
                          type="button"
                          className={styles.inlineLink}
                          onClick={() => {
                            setCategory(link.category);
                            navigate('catalogue', { category: link.category });
                          }}
                        >
                          {link.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>
        ) : null}

        {view === 'catalogue' ? (
          <section>
            {heading(CATEGORY_LABELS[category])}
            <p className={styles.bodyText}>Trade pricing shown where available. Configure opens CPQ with this row's ruleset.</p>
            {catalogueMock ? <p className={styles.warningLine}>Mock catalogue mode enabled.</p> : null}
            {catalogueWarnings.length ? <div className={styles.warningBox}>Some rows fell back to static data: {catalogueWarnings.join(' · ')}</div> : null}
            <div className={styles.cardGrid}>
              {cards.map((card) => (
                <article key={card.id} className={styles.productCard}>
                  <div className={styles.cardImage}>🚲</div>
                  <div className={styles.cardBody}>
                    <h3>{card.title}</h3>
                    {card.subtitle ? <p>{card.subtitle}</p> : null}
                    <div className={styles.modelCode}>{card.modelCode}</div>
                    <ul>
                      {card.highlights.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
                    </ul>
                    <div className={styles.priceRow}>
                      <div>
                        <div className={styles.priceLabel}>Trade</div>
                        <div className={styles.priceMain}>{formatMoney(card.tradePrice, card.currencyCode)}</div>
                        <div className={styles.priceSub}>MSRP {formatMoney(card.msrp, card.currencyCode)}</div>
                      </div>
                      <button type="button" className={styles.primary} onClick={() => void startConfiguration(card)}>Configure</button>
                    </div>
                    <button
                      type="button"
                      className={styles.inlineLink}
                      onClick={() => {
                        setVariantBikeTypeId(card.bikeTypeId);
                        navigate('variants', { bikeTypeId: card.bikeTypeId });
                        void loadVariants(card.bikeTypeId, true);
                      }}
                    >
                      Browse configuration variants
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {loadingCatalogue ? <div className={styles.loading}>Loading catalogue…</div> : null}
            {catalogueError ? <div className={styles.error}>{catalogueError}</div> : null}
            {!loadingCatalogue && !cards.length && !catalogueError ? <p className={styles.bodyText}>No bikes in this category.</p> : null}
          </section>
        ) : null}

        {view === 'variants' ? (
          <section>
            {heading('Configuration variants')}
            <p className={styles.bodyText}>
              Bike type <code>{variantBikeTypeId}</code>
              {variantTotalKeys != null ? ` — ${variantTotalKeys} variant key${variantTotalKeys === 1 ? '' : 's'} configured.` : ''}
            </p>
            {variantsMock ? <p className={styles.warningLine}>Mock variants mode enabled.</p> : null}
            {variantsWarnings.length ? <div className={styles.warningBox}>Some variant keys failed CPQ start: {variantsWarnings.join(' · ')}</div> : null}
            <div className={styles.cardGrid}>
              {variants.map((card) => (
                <article key={card.id} className={styles.productCard}>
                  <div className={styles.cardImage}>🚲</div>
                  <div className={styles.cardBody}>
                    <h3>{card.title}</h3>
                    {card.subtitle ? <p>{card.subtitle}</p> : null}
                    <div className={styles.modelCode}>{card.modelCode}</div>
                    <ul>
                      {card.highlights.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
                    </ul>
                    <div className={styles.priceRow}>
                      <div>
                        <div className={styles.priceLabel}>Trade</div>
                        <div className={styles.priceMain}>{formatMoney(card.tradePrice, card.currencyCode)}</div>
                        <div className={styles.priceSub}>MSRP {formatMoney(card.msrp, card.currencyCode)}</div>
                      </div>
                      <button type="button" className={styles.primary} onClick={() => void startConfiguration(card, card.cpqDetailId)}>Open in builder</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {loadingVariants ? <div className={styles.loading}>Loading variants…</div> : null}
            {variantsError ? <div className={styles.error}>{variantsError}</div> : null}
            {variantCursor ? (
              <div className={styles.actionsRow}>
                <button type="button" className={styles.secondary} disabled={loadingMoreVariants} onClick={() => void loadVariants(variantBikeTypeId, false)}>
                  {loadingMoreVariants ? 'Loading…' : 'Load more'}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {view === 'configure' ? (
          <section className={styles.builderSection}>
            {heading('Bike Builder')}
            <p className={styles.bodyText}>Select options, then review and finalize.</p>
            {isMock ? <p className={styles.warningLine}>Mock CPQ mode enabled.</p> : null}
            {builderError ? <div className={styles.error}>{builderError}</div> : null}
            {status ? <div className={styles.warningBox}>{status}</div> : null}

            <div className={styles.builderHead}>
              <h2>Select options</h2>
              {isOptionsRefreshing ? <span className={styles.spinner} /> : null}
              <button type="button" className={styles.secondary} onClick={() => void resetBuilder()} disabled={!selectedCard || isLoadingBuilder}>Load existing configuration</button>
            </div>

            {!state || isLoadingBuilder ? <div className={styles.loading}>Loading configuration…</div> : null}

            {state ? (
              <div className={styles.optionColumns}>
                {[visibleFeatures.slice(0, Math.ceil(visibleFeatures.length / 2)), visibleFeatures.slice(Math.ceil(visibleFeatures.length / 2))].map((column, idx) => (
                  <div key={idx} className={styles.optionColumn}>
                    {column.map((feature: FeatureField) => (
                      <label key={feature.featureKey} className={styles.field}>
                        <span>{feature.label}</span>
                        <select value={feature.selectedValue} onChange={(event) => queueSelection(feature.cpqOptionId, event.target.value)} disabled={!feature.isEnabled}>
                          {feature.options.map((option) => <option key={`${feature.featureKey}-${option.optionId || option.value}`} value={option.value}>{option.caption}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}

            {state ? (
              <div className={styles.review}>
                <h2>Review quantity</h2>
                <div className={styles.reviewGrid}>
                  <div>
                    <ReadonlyField label="Description" value={state.productDescription} busy={isReviewRefreshing} />
                    <ReadonlyField label="Product code" value={state.productCode} busy={isReviewRefreshing} />
                  </div>
                  <div>
                    <ReadonlyField label="Weight" value={state.weightKg != null ? `${state.weightKg.toFixed(2)}kg` : '—'} busy={isReviewRefreshing} />
                    <ReadonlyField label="Trade price" value={formatMoney(state.tradePrice ?? state.configuredPrice, state.currencyCode)} busy={isReviewRefreshing} />
                    <ReadonlyField label="MSRP" value={formatMoney(state.msrp, state.currencyCode)} busy={isReviewRefreshing} />
                  </div>
                </div>
              </div>
            ) : null}

            {state ? (
              <div className={styles.orderActions}>
                <button type="button" className={styles.secondaryStrong} onClick={() => void resetBuilder()} disabled={isFinalizing}>Reset build</button>
                <div>
                  <button type="button" className={styles.secondaryStrong} onClick={() => void finalizeBuilder('Add to existing order')} disabled={isFinalizing}>Add to existing order</button>
                  <button type="button" className={styles.primary} onClick={() => void finalizeBuilder('Add to new order')} disabled={isFinalizing}>{isFinalizing ? 'Finalizing…' : 'Add to new order'}</button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}

function ReadonlyField({ label, value, busy }: { label: string; value: string; busy: boolean }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <div className={styles.readonlyValue}>{busy && !value ? 'Updating…' : value || '—'}</div>
    </label>
  );
}
