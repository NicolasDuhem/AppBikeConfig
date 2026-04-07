import { NextResponse } from 'next/server';
import { requireApiLogin } from '@/lib/api-auth';
import { IMPORT_CPQ_FLAG_KEY, isFeatureEnabled } from '@/lib/feature-flags';

export async function GET() {
  const auth = await requireApiLogin();
  if (auth instanceof NextResponse) return auth;

  const importCsvCpq = await isFeatureEnabled(IMPORT_CPQ_FLAG_KEY);
  return NextResponse.json({ import_csv_cpq: importCsvCpq, roles: auth.roles });
}
