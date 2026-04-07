import { redirect } from 'next/navigation';
import { getCurrentUserRoles } from '@/lib/auth';
import { IMPORT_CPQ_FLAG_KEY, isFeatureEnabled } from '@/lib/feature-flags';
import CpqFeatureClient from './page-client';

export default async function CpqFeaturePage() {
  const roles = await getCurrentUserRoles();
  const isEnabled = await isFeatureEnabled(IMPORT_CPQ_FLAG_KEY);

  if (!isEnabled || !roles.some((role) => ['sys_admin', 'product_admin'].includes(role))) {
    redirect('/bike-builder');
  }

  return <CpqFeatureClient />;
}
