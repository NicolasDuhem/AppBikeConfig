import type { FeatureField } from "../../types/bike-builder";
import { OptionField } from "./OptionField";

type Props = {
  features: FeatureField[];
  disabled: boolean;
  onChange: (cpqOptionId: string, value: string) => void;
};

export function OptionGrid({ features, disabled, onChange }: Props) {
  const visible = features.filter((f) => f.isVisible);
  const mid = Math.ceil(visible.length / 2);
  const left = visible.slice(0, mid);
  const right = visible.slice(mid);

  return (
    <div className="grid grid-cols-1 gap-x-12 gap-y-5 md:grid-cols-2">
      <div className="flex flex-col gap-5">
        {left.map((f) => (
          <OptionField key={f.featureKey} feature={f} disabled={disabled} onChange={onChange} />
        ))}
      </div>
      <div className="flex flex-col gap-5">
        {right.map((f) => (
          <OptionField key={f.featureKey} feature={f} disabled={disabled} onChange={onChange} />
        ))}
      </div>
    </div>
  );
}
