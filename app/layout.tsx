import './globals.css';
import Link from 'next/link';
import LogoutButton from '@/components/logout-button';

const links = [
  ['/', 'Home'],
  ['/matrix', 'Matrix'],
  ['/sku-definition', 'Bike SKU Definition'],
  ['/bike-builder', 'Bike Builder'],
  ['/users', 'Users']
];

export const metadata = {
  title: 'Brompton AppBikeConfig',
  description: 'Bike configurator starter'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <div className="brandbar">
            <div>
              <div className="brandtitle">Brompton</div>
              <div>AppBikeConfig · Next.js + Neon starter</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div>Brand colour #002FA7</div>
              <LogoutButton />
            </div>
          </div>
          <div className="tabs">
            {links.map(([href, label]) => (
              <Link className="tab" key={href} href={href}>{label}</Link>
            ))}
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}
