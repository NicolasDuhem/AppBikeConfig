import type { CpqMatrixRow } from '@/lib/types';

export function canShowPickPictureAction(enabled: boolean) {
  return !!enabled;
}

export function hasLinkedPicture(row: Pick<CpqMatrixRow, 'picture_asset_url'>) {
  return !!String(row.picture_asset_url || '').trim();
}

export function canPreviewPicture(url: string) {
  return /^https?:\/\/.+/i.test(String(url || '').trim());
}
