'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type NavLink = { href: string; label: string; hidden?: boolean };

export default function AppNavigation() {
  const pathname = usePathname();
  const [links, setLinks] = useState<NavLink[]>([
    { href: '/cpq-matrix', label: 'Sales - SKU vs Country' },
    { href: '/sku-definition', label: 'Product - SKU definition' },
    { href: '/cpq-feature', label: 'Product - Create SKU' },
    { href: '/users', label: 'Admin - Users' }
  ]);

  useEffect(() => {
    fetch('/api/feature-flags/public')
      .then((res) => res.json())
      .then((data) => {
        const roleList: string[] = data.roles || [];
        const permissionList: string[] = data.permissions || [];

        setLinks([
          { href: '/cpq-matrix', label: 'Sales - SKU vs Country' },
          { href: '/sku-definition', label: 'Product - SKU definition' },
          { href: '/cpq-feature', label: 'Product - Create SKU' },
          { href: '/setup', label: 'Product - Setup', hidden: !permissionList.includes('setup.manage') },
          { href: '/users', label: 'Admin - Users' },
          { href: '/feature-flags', label: 'Admin - Feature flag', hidden: !roleList.includes('sys_admin') && !permissionList.includes('feature_flags.manage') },
          { href: '/admin/api-docs', label: 'Admin - API docs', hidden: !roleList.includes('sys_admin') }
        ]);
      })
      .catch(() => {});
  }, []);

  return (
    <nav className="tabs" aria-label="Primary navigation">
      {links.filter((link) => !link.hidden).map((link) => {
        const isActive = pathname === link.href;
        return <Link className={`tab ${isActive ? 'tabActive' : ''}`} key={link.href} href={link.href} aria-current={isActive ? 'page' : undefined}>{link.label}</Link>;
      })}
    </nav>
  );
}
