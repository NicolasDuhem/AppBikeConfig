import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { api } from "../lib/api/client";
import {
  type BikeSkuCard,
  type CatalogueApiResponse,
  type CatalogueCategory,
  isCatalogueCategory,
} from "../types/bike-builder";

const CATEGORY_HEADLINE: Record<CatalogueCategory, string> = {
  "all-bikes": "All bikes",
  "c-line": "C Line",
  "p-line": "P Line",
  "g-line": "G Line",
  "t-line": "T Line",
  "special-editions": "Special editions",
  electric: "Electric bikes",
  "electric-c-line": "C Line electric",
  "electric-p-line": "P Line electric",
  "electric-g-line": "G Line electric",
  "electric-t-line": "T Line electric",
};

function formatMoney(amount: number | null | undefined, currency = "GBP"): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
  } catch {
    return `£${amount.toFixed(2)}`;
  }
}

function stockLabel(status: BikeSkuCard["stockStatus"]): string {
  switch (status) {
    case "in-stock":
      return "In stock";
    case "low-stock":
      return "Low stock";
    case "pre-order":
      return "Pre-order";
    default:
      return "";
  }
}

function stockClass(status: BikeSkuCard["stockStatus"]): string {
  switch (status) {
    case "in-stock":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "low-stock":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "pre-order":
      return "bg-sky-50 text-sky-900 border-sky-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

function BikeCard({ card }: { card: BikeSkuCard }) {
  const search = new URLSearchParams({
    ruleset: card.configureQuery.ruleset,
    namespace: card.configureQuery.namespace,
    headerId: card.configureQuery.headerId,
  });
  if (card.configureQuery.variantKey?.trim()) {
    search.set("variantKey", card.configureQuery.variantKey.trim());
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-white shadow-sm">
      <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200">
        {card.imageUrl ? (
          <img src={card.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-gray-400" aria-hidden>
            🚲
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span className="rounded bg-white/90 px-2 py-0.5 text-xs font-semibold text-[var(--color-text)] shadow-sm">
            {card.familyLabel}
          </span>
          {card.isElectric ? (
            <span className="rounded bg-[var(--color-primary)] px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
              Electric
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-semibold text-[var(--color-text)]">{card.title}</h3>
        {card.subtitle ? (
          <p className="mt-1 text-sm text-[var(--color-muted)]">{card.subtitle}</p>
        ) : null}
        <p className="mt-2 font-mono text-xs text-gray-600">{card.modelCode}</p>
        <ul className="mt-3 space-y-1 text-xs text-[var(--color-text)]">
          {card.highlights.slice(0, 4).map((h) => (
            <li key={h} className="flex gap-2">
              <span className="text-[var(--color-primary)]" aria-hidden>
                •
              </span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-4">
          {card.stockStatus ? (
            <span
              className={`rounded border px-2 py-0.5 text-[11px] font-medium ${stockClass(card.stockStatus)}`}
            >
              {stockLabel(card.stockStatus)}
            </span>
          ) : null}
          {card.leadTimeLabel ? (
            <span className="text-[11px] text-[var(--color-muted)]">Lead {card.leadTimeLabel}</span>
          ) : null}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
                Trade
              </p>
              <p className="text-lg font-bold text-[var(--color-text)]">
                {formatMoney(card.tradePrice, card.currencyCode)}
              </p>
              <p className="text-xs text-[var(--color-muted)]">
                MSRP {formatMoney(card.msrp, card.currencyCode)}
              </p>
            </div>
            <Link
              to={`/configure?${search.toString()}`}
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
            >
              Configure
            </Link>
          </div>
          <Link
            to={`/variants/${encodeURIComponent(card.bikeTypeId)}`}
            className="text-center text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            Browse configuration variants
          </Link>
        </div>
      </div>
    </article>
  );
}

export function CataloguePage() {
  const { categorySlug } = useParams<{ categorySlug: string }>();

  if (!categorySlug || !isCatalogueCategory(categorySlug)) {
    return <Navigate to="/catalogue/categories" replace />;
  }

  const category = categorySlug;

  const q = useQuery({
    queryKey: ["catalogue", category],
    queryFn: async () => {
      const { data } = await api.get<CatalogueApiResponse>("/cpq/catalogue", {
        params: { category },
      });
      return data;
    },
  });

  const headline = CATEGORY_HEADLINE[category];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-muted)]">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link to="/" className="hover:text-[var(--color-text)]">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link to="/catalogue/categories" className="hover:text-[var(--color-text)]">
              Catalogue
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-[var(--color-text)]">{headline}</li>
        </ol>
      </nav>

      <div className="mt-6 flex flex-col gap-6 border-b border-[var(--color-border)] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1
            className="text-3xl font-bold text-[var(--color-text)] md:text-4xl"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {headline}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Trade pricing shown where available. Configure opens CPQ with this row&apos;s ruleset
            {category === "all-bikes"
              ? ' — "All bikes" lists every entry in CPQ_RULESETS_JSON (electric and non-electric).'
              : "."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <span className="sr-only">Sort</span>
            <span aria-hidden>Sort</span>
            <select
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)]"
              defaultValue="featured"
              disabled
            >
              <option value="featured">Featured</option>
            </select>
          </label>
          <div
            className="flex rounded-md border border-[var(--color-border)] p-0.5 text-sm"
            role="group"
            aria-label="View mode"
          >
            <button
              type="button"
              className="rounded bg-[var(--color-primary)] px-3 py-1.5 font-medium text-white"
              disabled
            >
              Grid
            </button>
            <button
              type="button"
              className="rounded px-3 py-1.5 font-medium text-[var(--color-muted)]"
              disabled
            >
              List
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-[var(--color-border)] bg-[#fafafa] px-4 py-3 text-sm text-[var(--color-muted)]">
        <span className="font-medium text-[var(--color-text)]">Filters</span>
        <input
          type="search"
          placeholder="Search catalogue (POC)"
          className="min-w-[200px] flex-1 rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          disabled
        />
      </div>

      {q.isLoading ? (
        <div className="py-20 text-center text-[var(--color-muted)]">Loading catalogue…</div>
      ) : q.isError ? (
        <div className="mt-8 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not load catalogue.
        </div>
      ) : q.data && !q.data.ok ? (
        <div className="mt-8 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {q.data.error ?? "Catalogue request failed"}
        </div>
      ) : (
        <>
          {q.data?.mock ? (
            <p className="mt-4 text-xs font-medium text-amber-800">
              Mock catalogue (CPQ_MOCK=1 or no API key): cards use curated static data.
            </p>
          ) : null}
          {q.data?.errors?.length ? (
            <div
              className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"
              role="status"
            >
              Some rows fell back to static data: {q.data.errors.join(" · ")}
            </div>
          ) : null}
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {q.data?.cards.map((c) => (
              <BikeCard key={c.id} card={c} />
            ))}
          </div>
          {q.data?.cards.length === 0 ? (
            <p className="mt-10 text-center text-sm text-[var(--color-muted)]">
              No bikes in this category for the current catalogue configuration.
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}
