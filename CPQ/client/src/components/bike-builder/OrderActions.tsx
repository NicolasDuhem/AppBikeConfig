type Props = {
  onReset: () => void;
  onAddExisting: () => void;
  onAddNew: () => void;
  disabled: boolean;
};

export function OrderActions({ onReset, onAddExisting, onAddNew, disabled }: Props) {
  return (
    <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={onReset}
        disabled={disabled}
        className="rounded-md border-2 border-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-primary)] hover:bg-blue-50 disabled:opacity-50"
      >
        Reset build
      </button>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onAddExisting}
          disabled={disabled}
          className="rounded-md border-2 border-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-primary)] hover:bg-blue-50 disabled:opacity-50"
        >
          Add to existing order
        </button>
        <button
          type="button"
          onClick={onAddNew}
          disabled={disabled}
          className="rounded-md bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          Add to new order
        </button>
      </div>
    </div>
  );
}
