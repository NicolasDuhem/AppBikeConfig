import { redirect } from 'next/navigation';
import { getCurrentUserRoles } from '@/lib/auth';
import CpqPageClient from '@/app/cpq/page-client';

export default async function CpqPage() {
  const roles = await getCurrentUserRoles();
  if (!roles.some((role) => ['sys_admin', 'product_admin'].includes(role))) {
    redirect('/cpq-matrix');
  }

  return <CpqPageClient />;
}
