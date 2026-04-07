import { NextResponse } from 'next/server';
import { requireApiLogin } from '@/lib/api-auth';
import { CPQ_BDAM_PICTURE_PICKER_FLAG_KEY, IMPORT_CPQ_FLAG_KEY, isFeatureEnabled } from '@/lib/feature-flags';

export async function GET() {
  const auth = await requireApiLogin();
  if (auth instanceof NextResponse) return auth;

  const importCsvCpq = await isFeatureEnabled(IMPORT_CPQ_FLAG_KEY);
  const cpqBdamPicturePicker = await isFeatureEnabled(CPQ_BDAM_PICTURE_PICKER_FLAG_KEY);
  return NextResponse.json({ import_csv_cpq: importCsvCpq, cpq_bdam_picture_picker: cpqBdamPicturePicker, roles: auth.roles, permissions: auth.permissions });
}
