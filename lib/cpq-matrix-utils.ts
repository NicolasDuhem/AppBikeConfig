import type { BrakeType } from '@/lib/types';

export function isValidBrakeType(value: string): value is BrakeType {
  return value === 'reverse' || value === 'non_reverse';
}

export function brakeTypesMatch(skuBrakeType: string, countryBrakeType: string) {
  return skuBrakeType === countryBrakeType;
}
