import { NavLink, Outlet } from "react-router-dom";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "text-[var(--color-primary)]"
    : "text-[#4b5563] hover:text-[var(--color-text)]";

export function AppShell() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[var(--color-border)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-4 lg:px-6">
          <NavLink
            to="/"
            className="text-xl font-bold tracking-tight text-[var(--color-text)]"
            style={{ fontFamily: "var(--font-serif)" }}
            end
          >
            BROMPTON
          </NavLink>
          <nav className="hidden flex-1 flex-wrap items-center gap-6 text-sm font-medium md:flex">
            <NavLink to="/catalogue/categories" className={navLinkClass}>
              Catalogue
            </NavLink>
            <NavLink to="/configure" className={navLinkClass}>
              Configure
            </NavLink>
            <a className="text-[#4b5563] hover:text-[var(--color-text)]" href="#orders">
              Orders
            </a>
            <a className="text-[#4b5563] hover:text-[var(--color-text)]" href="#invoices">
              Invoices and credits
            </a>
            <a className="text-[#4b5563] hover:text-[var(--color-text)]" href="#support">
              Customer service
            </a>
            <a className="text-[#4b5563] hover:text-[var(--color-text)]" href="#assets">
              Assets
            </a>
          </nav>
          <div className="flex flex-1 items-center justify-end gap-3 md:flex-none">
            <div className="hidden max-w-md flex-1 md:block">
              <input
                type="search"
                placeholder="Advanced search"
                className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                readOnly
              />
            </div>
            <span className="text-xl text-[#6b7280]" aria-hidden>
              🔔
            </span>
            <span className="text-xl text-[#6b7280]" aria-hidden>
              👤
            </span>
            <span className="relative text-xl" aria-hidden>
              🛒
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                2
              </span>
            </span>
          </div>
        </div>
      </header>

      <Outlet />

      <button
        type="button"
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)] text-2xl text-white shadow-lg hover:bg-[var(--color-primary-hover)]"
        aria-label="Chat"
      >
        💬
      </button>
    </div>
  );
}
