import { redirect } from 'next/navigation';
import { getCurrentUserRoles } from '@/lib/auth';
import FeatureFlagsClient from './page-client';

export default async function FeatureFlagsPage() {
  const roles = await getCurrentUserRoles();
  if (!roles.includes('sys_admin')) {
    redirect('/cpq-matrix');
  }

  return <FeatureFlagsClient />;
}
