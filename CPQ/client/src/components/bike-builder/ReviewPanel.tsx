type Props = {
  description: string;
  productCode: string;
  weightLabel: string;
  tradePriceLabel: string;
  msrpLabel: string;
  isRefreshing: boolean;
};

export function ReviewPanel({
  description,
  productCode,
  weightLabel,
  tradePriceLabel,
  msrpLabel,
  isRefreshing,
}: Props) {
  return (
    <div className="mt-10 border-t border-[var(--color-border)] pt-8">
      <h2 className="mb-6 text-lg font-semibold text-[var(--color-text)]">Review quantity</h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-5">
          <ReadonlyField label="Description" value={description} busy={isRefreshing} />
          <ReadonlyField label="Product code" value={productCode} busy={isRefreshing} />
        </div>
        <div className="flex flex-col gap-5">
          <ReadonlyField label="Weight" value={weightLabel} busy={isRefreshing} />
          <ReadonlyField label="Trade price" value={tradePriceLabel} busy={isRefreshing} />
          <ReadonlyField label="MSRP" value={msrpLabel} busy={isRefreshing} />
        </div>
      </div>
    </div>
  );
}

function ReadonlyField({
  label,
  value,
  busy,
}: {
  label: string;
  value: string;
  busy: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[#374151]">{label}</span>
      <div
        className={`min-h-[42px] rounded-md border border-[var(--color-border)] bg-[#fafafa] px-3 py-2.5 text-sm ${busy ? "opacity-70" : ""}`}
      >
        {busy && !value ? (
          <span className="text-[var(--color-muted)]">Updating…</span>
        ) : (
          <span className="break-all">{value || "—"}</span>
        )}
      </div>
    </div>
  );
}
