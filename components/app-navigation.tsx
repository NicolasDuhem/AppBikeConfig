'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/matrix', label: 'Matrix' },
  { href: '/sku-definition', label: 'Bike SKU Definition' },
  { href: '/bike-builder', label: 'Bike Builder' },
  { href: '/users', label: 'Users' }
];

export default function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav className="tabs" aria-label="Primary navigation">
      {links.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link className={`tab ${isActive ? 'tabActive' : ''}`} key={link.href} href={link.href} aria-current={isActive ? 'page' : undefined}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
