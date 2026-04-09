import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 lg:px-6">
      <h1
        className="text-3xl font-bold text-[var(--color-text)] md:text-4xl"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        Brompton Trade
      </h1>
      <p className="mt-3 max-w-xl text-sm text-[var(--color-muted)]">
        Browse the catalogue by line, then open Configure to build a bike in CPQ.
      </p>
      <div className="mt-8 flex flex-wrap gap-4">
        <Link
          to="/catalogue/categories"
          className="rounded-md bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
        >
          Browse catalogue
        </Link>
        <Link
          to="/configure"
          className="rounded-md border border-[var(--color-border)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--color-text)] hover:bg-gray-50"
        >
          Configure a bike
        </Link>
      </div>
    </main>
  );
}
