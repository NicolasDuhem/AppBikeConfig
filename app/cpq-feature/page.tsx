import { redirect } from 'next/navigation';
import { getCurrentUserRoles } from '@/lib/auth';
import CpqFeatureClient from './page-client';

export default async function CpqFeaturePage() {
  const roles = await getCurrentUserRoles();

  if (!roles.some((role) => ['sys_admin', 'product_admin'].includes(role))) {
    redirect('/cpq-matrix');
  }

  return <CpqFeatureClient />;
}
