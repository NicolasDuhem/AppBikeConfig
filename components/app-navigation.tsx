'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type NavLink = { href: string; label: string; hidden?: boolean };

export default function AppNavigation() {
  const pathname = usePathname();
  const [links, setLinks] = useState<NavLink[]>([{ href: '/matrix', label: 'Matrix' }, { href: '/sku-definition', label: 'Bike SKU Definition' }, { href: '/bike-builder', label: 'Bike Builder' }, { href: '/users', label: 'Users' }]);

  useEffect(() => {
    fetch('/api/feature-flags/public')
      .then((res) => res.json())
      .then((data) => {
        const roleList: string[] = data.roles || [];
        const cpqEnabled = !!data.import_csv_cpq;

        const next: NavLink[] = [
          { href: cpqEnabled ? '/cpq-matrix' : '/matrix', label: cpqEnabled ? 'CPQ Matrix' : 'Matrix' },
          { href: '/sku-definition', label: 'Bike SKU Definition' },
          { href: '/bike-builder', label: 'Bike Builder', hidden: cpqEnabled },
          { href: '/cpq-feature', label: 'CPQ Feature', hidden: !cpqEnabled },
          { href: '/users', label: 'Users' },
          { href: '/feature-flags', label: 'Feature Flags', hidden: !roleList.includes('sys_admin') }
        ];
        setLinks(next);
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
