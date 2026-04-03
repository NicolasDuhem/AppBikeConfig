import './globals.css';
import LogoutButton from '@/components/logout-button';
import AppNavigation from '@/components/app-navigation';

export const metadata = {
  title: 'Brompton AppBikeConfig',
  description: 'Bike configurator starter'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="brandbar">
            <div>
              <div className="brandtitle">Brompton</div>
              <div className="brandSubtitle">AppBikeConfig · Admin Console</div>
            </div>
            <div className="brandMeta">
              <div>Brand colour #002FA7</div>
              <LogoutButton />
            </div>
          </header>
          <AppNavigation />
          {children}
        </div>
      </body>
    </html>
  );
}
