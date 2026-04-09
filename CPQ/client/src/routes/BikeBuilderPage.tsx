import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { OptionGrid } from "../components/bike-builder/OptionGrid";
import { OrderActions } from "../components/bike-builder/OrderActions";
import { ReviewPanel } from "../components/bike-builder/ReviewPanel";
import { useBikeBuilder } from "../lib/bike-builder/useBikeBuilder";
import type { CpqStartBody } from "../types/bike-builder";

function formatMoney(amount: number | null | undefined, currency = "GBP"): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
  } catch {
    return `£${amount.toFixed(2)}`;
  }
}

export function BikeBuilderPage() {
  const [searchParams] = useSearchParams();
  const { startBody, startKey } = useMemo(() => {
    const ruleset = searchParams.get("ruleset")?.trim();
    const namespace = searchParams.get("namespace")?.trim();
    const headerId = searchParams.get("headerId")?.trim();
    const variantKey = searchParams.get("variantKey")?.trim();
    const detailId = searchParams.get("detailId")?.trim();
    const body: CpqStartBody = {};
    if (ruleset) body.partName = ruleset;
    if (namespace) body.partNamespace = namespace;
    if (headerId) body.headerId = headerId;
    if (variantKey) body.variantKey = variantKey;
    if (detailId) body.detailId = detailId;
    const keys = Object.keys(body);
    return {
      startBody: keys.length ? body : undefined,
      startKey: keys.length
        ? `${ruleset ?? ""}|${namespace ?? ""}|${headerId ?? ""}|${variantKey ?? ""}|${detailId ?? ""}`
        : "default",
    };
  }, [searchParams]);

  const {
    state,
    isMock,
    isLoading,
    isReviewRefreshing,
    isOptionsRefreshing,
    error,
    selectOption,
    resetBuild,
    finalize,
  } = useBikeBuilder({ startBody, startKey });

  const weightLabel =
    state?.weightKg != null ? `${state.weightKg.toFixed(2)}kg` : state ? "—" : "";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
        <div className="mb-2 flex items-start justify-between gap-4">
          <div>
            <h1
              className="text-3xl font-bold text-[var(--color-text)] md:text-4xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Bike Builder
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">//</p>
            {isMock && (
              <p className="mt-2 text-xs font-medium text-amber-700">
                Mock CPQ mode (set CPQ_API_KEY and CPQ_MOCK=0 for live Infor)
              </p>
            )}
          </div>
        </div>

        {error && (
          <div
            className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        )}

        <section className="rounded-lg border border-[var(--color-border)] bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Select options</h2>
              {isOptionsRefreshing && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
              )}
            </div>
            <button
              type="button"
              disabled={isLoading || isOptionsRefreshing}
              onClick={() => {
                void resetBuild();
              }}
              className="rounded-md border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-gray-50 disabled:opacity-50"
            >
              Load existing configuration
            </button>
          </div>

          {isLoading || !state ? (
            <div className="py-16 text-center text-[var(--color-muted)]">Loading configuration…</div>
          ) : (
            <OptionGrid
              features={state.features}
              disabled={false}
              onChange={selectOption}
            />
          )}

          {state && (
            <ReviewPanel
              description={state.productDescription}
              productCode={state.productCode}
              weightLabel={weightLabel}
              tradePriceLabel={formatMoney(state.tradePrice ?? state.configuredPrice, state.currencyCode)}
              msrpLabel={formatMoney(state.msrp, state.currencyCode)}
              isRefreshing={isReviewRefreshing}
            />
          )}

          {state && (
            <OrderActions
              disabled={isLoading || isOptionsRefreshing}
              onReset={() => void resetBuild()}
              onAddExisting={async () => {
                await finalize();
                alert("POC: Finalize called. Hook Add to existing order to platform extension service.");
              }}
              onAddNew={async () => {
                await finalize();
                alert("POC: Finalize called. Hook Add to new order to platform extension service.");
              }}
            />
          )}
        </section>
    </main>
  );
}
