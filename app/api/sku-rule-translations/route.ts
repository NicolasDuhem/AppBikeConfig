import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireApiLogin, requireApiRole } from '@/lib/api-auth';
import { writeAuditLog } from '@/lib/audit';

type TranslationPatch = {
  cpq_import_row_id: number;
  translated_value: string;
};

function normalizeLocale(value: string) {
  return value.trim();
}

export async function GET(request: Request) {
  const auth = await requireApiLogin();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const locale = normalizeLocale(String(searchParams.get('locale') || ''));
  const includeInactive = searchParams.get('include_inactive') === '1';

  if (!locale) {
    return NextResponse.json({ error: 'locale is required' }, { status: 400 });
  }

  const localeRows = await sql`
    select distinct nullif(trim(locale_code), '') as locale
    from cpq_countries
    where nullif(trim(locale_code), '') is not null
    order by locale
  ` as Array<{ locale: string | null }>;

  const locales = localeRows.map((row) => String(row.locale || '').trim()).filter(Boolean);
  if (!locales.length) locales.push('en-US');

  const rows = includeInactive
    ? await sql`
      select r.id as cpq_import_row_id,
             r.digit_position,
             r.option_name,
             r.code_value,
             r.choice_value,
             coalesce(r.is_active, true) as is_active,
             t.translated_value,
             t.updated_at as translation_updated_at,
             u.email as translation_updated_by_email
      from cpq_import_rows r
      left join cpq_import_row_translations t
        on t.cpq_import_row_id = r.id
       and t.locale = ${locale}
      left join app_users u
        on u.id = t.updated_by
      where r.status = 'imported'
      order by r.digit_position, r.option_name, r.choice_value, r.id
    `
    : await sql`
      select r.id as cpq_import_row_id,
             r.digit_position,
             r.option_name,
             r.code_value,
             r.choice_value,
             coalesce(r.is_active, true) as is_active,
             t.translated_value,
             t.updated_at as translation_updated_at,
             u.email as translation_updated_by_email
      from cpq_import_rows r
      left join cpq_import_row_translations t
        on t.cpq_import_row_id = r.id
       and t.locale = ${locale}
      left join app_users u
        on u.id = t.updated_by
      where r.status = 'imported'
        and coalesce(r.is_active, true) = true
      order by r.digit_position, r.option_name, r.choice_value, r.id
    `;

  return NextResponse.json({ locale, locales, rows });
}

export async function PATCH(request: Request) {
  const auth = await requireApiRole('sku.manage');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const locale = normalizeLocale(String(body.locale || ''));
  const updates = Array.isArray(body.updates) ? (body.updates as TranslationPatch[]) : [];

  if (!locale) {
    return NextResponse.json({ error: 'locale is required' }, { status: 400 });
  }

  if (!updates.length) {
    return NextResponse.json({ error: 'updates are required' }, { status: 400 });
  }

  const saved: Array<{ cpq_import_row_id: number; translated_value: string }> = [];
  const cleared: number[] = [];

  for (const entry of updates) {
    const cpqImportRowId = Number(entry.cpq_import_row_id || 0);
    if (!cpqImportRowId) continue;

    const exists = await sql`
      select id
      from cpq_import_rows
      where id = ${cpqImportRowId}
        and status = 'imported'
      limit 1
    ` as any[];
    if (!exists.length) continue;

    const translatedValue = String(entry.translated_value || '').trim();

    if (!translatedValue) {
      await sql`
        delete from cpq_import_row_translations
        where cpq_import_row_id = ${cpqImportRowId}
          and locale = ${locale}
      `;
      cleared.push(cpqImportRowId);
      continue;
    }

    const rows = await sql`
      insert into cpq_import_row_translations (
        cpq_import_row_id,
        locale,
        translated_value,
        created_by,
        updated_by
      )
      values (${cpqImportRowId}, ${locale}, ${translatedValue}, ${auth.user.id}, ${auth.user.id})
      on conflict (cpq_import_row_id, locale)
      do update set
        translated_value = excluded.translated_value,
        updated_at = now(),
        updated_by = excluded.updated_by
      returning cpq_import_row_id, translated_value
    ` as Array<{ cpq_import_row_id: number; translated_value: string }>;

    if (rows[0]) saved.push(rows[0]);
  }

  await writeAuditLog({
    userId: auth.user.id,
    actionKey: 'sku.manage.translation',
    entityType: 'cpq_import_row_translation',
    entityId: locale,
    newData: {
      locale,
      updatedRows: saved.map((row) => row.cpq_import_row_id),
      clearedRows: cleared
    }
  });

  return NextResponse.json({ locale, saved, cleared });
}
