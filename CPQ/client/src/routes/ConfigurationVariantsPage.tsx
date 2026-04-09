import { useInfiniteQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { api } from "../lib/api/client";
import type { ConfigurationVariantCard, ConfigurationVariantsApiResponse } from "../types/bike-builder";

const PAGE_LIMIT = 8;

function formatMoney(amount: number | null | undefined, currency = "GBP"): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
  } catch {
    return `£${amount.toFixed(2)}`;
  }
}

function VariantCard({ card }: { card: ConfigurationVariantCard }) {
  const search = new URLSearchParams({
    ruleset: card.configureQuery.ruleset,
    namespace: card.configureQuery.namespace,
    headerId: card.configureQuery.headerId,
    detailId: card.cpqDetailId,
  });
  if (card.configureQuery.variantKey?.trim()) {
    search.set("variantKey", card.configureQuery.variantKey.trim());
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-white shadow-sm">
      <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200">
        <div className="flex h-full w-full items-center justify-center text-4xl text-gray-400" aria-hidden>
          🚲
        </div>
        {card.variantKey ? (
          <div className="absolute left-3 top-3">
            <span className="rounded bg-white/90 px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--color-text)] shadow-sm">
              {card.variantKey}
            </span>
          </div>
        ) : null}
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
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-[var(--color-border)] pt-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted)]">Trade</p>
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
            Open in builder
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ConfigurationVariantsPage() {
  const { bikeTypeId: rawId } = useParams<{ bikeTypeId: string }>();
  const bikeTypeId = rawId?.trim() ?? "";

  if (!bikeTypeId) {
    return <Navigate to="/catalogue/categories" replace />;
  }

  const q = useInfiniteQuery({
    queryKey: ["configuration-variants", bikeTypeId],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const res = await api.get<ConfigurationVariantsApiResponse>("/cpq/configuration-variants", {
        params: { bikeTypeId, cursor: pageParam, limit: PAGE_LIMIT },
        validateStatus: (s) => (s >= 200 && s < 300) || s === 400 || s === 404,
      });
      const data = res.data;
      if (res.status === 404 || res.status === 400 || !data.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      return data;
    },
    getNextPageParam: (last) => (last.nextCursor != null ? Number(last.nextCursor) : undefined),
  });

  const variants = q.data?.pages.flatMap((p) => p.variants) ?? [];
  const totalKeys = q.data?.pages[0]?.totalVariantKeys;
  const mock = q.data?.pages.some((p) => p.mock);

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
          <li className="text-[var(--color-text)]">Variants</li>
        </ol>
      </nav>

      <div className="mt-6 border-b border-[var(--color-border)] pb-6">
        <h1
          className="text-3xl font-bold text-[var(--color-text)] md:text-4xl"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Configuration variants
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Bike type <span className="font-mono text-[var(--color-text)]">{bikeTypeId}</span>
          {totalKeys != null ? (
            <>
              {" "}
              — {totalKeys} variant key{totalKeys === 1 ? "" : "s"} configured for this POC
            </>
          ) : null}
        </p>
      </div>

      {q.isLoading ? (
        <div className="py-20 text-center text-[var(--color-muted)]">Loading variants…</div>
      ) : q.isError ? (
        <div className="mt-8 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {q.error instanceof Error ? q.error.message : "Could not load configuration variants."}
        </div>
      ) : (
        <>
          {mock ? (
            <p className="mt-4 text-xs font-medium text-amber-800">
              Mock variants (CPQ_MOCK=1 or no API key): synthetic cards per variant key slice.
            </p>
          ) : null}
          {q.data?.pages.some((p) => p.errors?.length) ? (
            <div
              className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"
              role="status"
            >
              Some variant keys failed CPQ start:{" "}
              {q.data.pages
                .flatMap((p) => p.errors ?? [])
                .filter(Boolean)
                .join(" · ")}
            </div>
          ) : null}
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {variants.map((c) => (
              <VariantCard key={c.id} card={c} />
            ))}
          </div>
          {variants.length === 0 ? (
            <p className="mt-10 text-center text-sm text-[var(--color-muted)]">
              No variants returned. Check <span className="font-mono">variantKeys</span> on this bike type in{" "}
              <span className="font-mono">CPQ_RULESETS_JSON</span> or{" "}
              <span className="font-mono">CPQ_GLOBAL_VARIANT_KEYS_JSON</span>.
            </p>
          ) : null}
          {q.hasNextPage ? (
            <div className="mt-10 flex justify-center">
              <button
                type="button"
                className="rounded-md border border-[var(--color-border)] bg-white px-6 py-2.5 text-sm font-semibold text-[var(--color-text)] hover:bg-gray-50 disabled:opacity-50"
                disabled={q.isFetchingNextPage}
                onClick={() => void q.fetchNextPage()}
              >
                {q.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
