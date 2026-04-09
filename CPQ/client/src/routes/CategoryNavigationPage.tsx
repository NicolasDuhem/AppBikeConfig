import { Link } from "react-router-dom";

type NavCol = {
  title: string;
  links: { label: string; to: string }[];
};

const columns: NavCol[] = [
  {
    title: "Bikes",
    links: [
      { label: "See all bikes", to: "/catalogue/all-bikes" },
      { label: "C Line", to: "/catalogue/c-line" },
      { label: "P Line", to: "/catalogue/p-line" },
      { label: "G Line", to: "/catalogue/g-line" },
      { label: "T Line", to: "/catalogue/t-line" },
      { label: "Special editions", to: "/catalogue/special-editions" },
    ],
  },
  {
    title: "Electric",
    links: [
      { label: "See all electric bikes", to: "/catalogue/electric" },
      { label: "C Line electric", to: "/catalogue/electric-c-line" },
      { label: "P Line electric", to: "/catalogue/electric-p-line" },
      { label: "G Line electric", to: "/catalogue/electric-g-line" },
      { label: "T Line electric", to: "/catalogue/electric-t-line" },
    ],
  },
];

export function CategoryNavigationPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
      <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-muted)]">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link to="/" className="hover:text-[var(--color-text)]">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-[var(--color-text)]">Catalogue</li>
        </ol>
      </nav>

      <h1
        className="mt-4 text-3xl font-bold text-[var(--color-text)] md:text-4xl"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        Catalogue
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
        Choose a line to view SKU-style cards. Each card links into Configure with the matching CPQ ruleset
        context.
      </p>

      <div className="mt-10 grid gap-10 md:grid-cols-2">
        {columns.map((col) => (
          <section
            key={col.title}
            className="rounded-lg border border-[var(--color-border)] bg-[#fafafa] p-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{col.title}</h2>
            <ul className="mt-4 space-y-2">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-sm font-medium text-[var(--color-primary)] hover:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-10 text-sm text-[var(--color-muted)]">
        Prefer to skip browsing?{" "}
        <Link to="/configure" className="font-medium text-[var(--color-primary)] hover:underline">
          Open Configure
        </Link>
      </p>
    </main>
  );
}
