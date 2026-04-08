export function normalizeLocale(value: string) {
  return String(value || '').trim();
}

export function resolveManagedLocale(requestedLocale: string, localeCatalog: string[]) {
  const normalizedCatalog = localeCatalog.map((locale) => normalizeLocale(locale)).filter(Boolean);
  const distinctCatalog = Array.from(new Set(normalizedCatalog));
  const locales = distinctCatalog.length ? distinctCatalog : ['en-US'];
  const requested = normalizeLocale(requestedLocale);
  const locale = requested && locales.includes(requested) ? requested : locales[0];
  return { locale, locales };
}
