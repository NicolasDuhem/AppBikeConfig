import { sql } from '@/lib/db';
import { normalizeLocale, resolveManagedLocale } from '@/lib/cpq-translation-locales';

type RuntimeLocaleInput = {
  requestedLocale?: string;
  countryId?: number | null;
  countryName?: string | null;
};

async function fetchManagedLocales() {
  const localeRows = await sql`
    select distinct nullif(trim(locale_code), '') as locale
    from cpq_countries
    where nullif(trim(locale_code), '') is not null
    order by locale
  ` as Array<{ locale: string | null }>;

  return localeRows.map((row) => normalizeLocale(String(row.locale || ''))).filter(Boolean);
}

async function fetchCountryLocale(countryId?: number | null, countryName?: string | null) {
  const normalizedCountry = String(countryName || '').trim();
  const normalizedCountryId = Number(countryId || 0);

  const rows = normalizedCountryId > 0
    ? await sql`
      select nullif(trim(locale_code), '') as locale
      from cpq_countries
      where id = ${normalizedCountryId}
      limit 1
    ` as Array<{ locale: string | null }>
    : normalizedCountry
      ? await sql`
        select nullif(trim(locale_code), '') as locale
        from cpq_countries
        where lower(country) = lower(${normalizedCountry})
        limit 1
      ` as Array<{ locale: string | null }>
      : [];

  return normalizeLocale(String(rows[0]?.locale || ''));
}

export async function resolveCpqRuntimeLocale({ requestedLocale = '', countryId = null, countryName = null }: RuntimeLocaleInput) {
  const managedLocales = await fetchManagedLocales();
  const { locale: fallbackLocale, locales } = resolveManagedLocale('', managedLocales);
  const normalizedRequestedLocale = normalizeLocale(requestedLocale);

  if (normalizedRequestedLocale && locales.includes(normalizedRequestedLocale)) {
    return { locale: normalizedRequestedLocale, locales, source: 'request' as const };
  }

  const countryLocale = await fetchCountryLocale(countryId, countryName);
  if (countryLocale && locales.includes(countryLocale)) {
    return { locale: countryLocale, locales, source: 'country' as const };
  }

  return { locale: fallbackLocale, locales, source: 'default' as const };
}
