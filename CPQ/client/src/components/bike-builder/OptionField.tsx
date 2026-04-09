import type { FeatureField } from "../../types/bike-builder";

type Props = {
  feature: FeatureField;
  disabled: boolean;
  onChange: (cpqOptionId: string, value: string) => void;
};

export function OptionField({ feature, disabled, onChange }: Props) {
  if (!feature.isVisible) return null;

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[#374151]">{feature.label}</span>
      <div className="relative">
        <select
          className="w-full appearance-none rounded-md border border-[var(--color-border)] bg-white py-2.5 pl-3 pr-10 text-sm text-[var(--color-text)] shadow-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] disabled:opacity-60"
          disabled={disabled || !feature.isEnabled}
          value={feature.selectedValue}
          onChange={(e) => onChange(feature.cpqOptionId, e.target.value)}
        >
          {feature.options.map((o) => (
            <option key={o.optionId || o.value} value={o.value}>
              {o.caption}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">▾</span>
      </div>
    </label>
  );
}
