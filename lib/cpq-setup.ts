import { sql } from '@/lib/db';

export type CpqAccountContextRecord = {
  id: number;
  account_code: string;
  customer_id: string;
  currency: string;
  language: string;
  country_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CpqRulesetRecord = {
  id: number;
  cpq_ruleset: string;
  description: string | null;
  bike_type: string | null;
  namespace: string;
  header_id: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CpqImageManagementRecord = {
  id: number;
  feature_label: string;
  option_label: string;
  option_value: string;
  feature_id: string | null;
  option_id: string | null;
  picture_link: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const parseBoolean = (value: unknown, fallback = true) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return fallback;
};

const asTrimmedText = (value: unknown) => String(value ?? '').trim();
const asNullableTrimmedText = (value: unknown) => {
  const trimmed = asTrimmedText(value);
  return trimmed.length ? trimmed : null;
};
const ISO2_COUNTRY_REGEX = /^[A-Z]{2}$/;

export async function listAccountContexts(activeOnly = false) {
  if (activeOnly) {
    return (await sql`
      select id, account_code, customer_id, currency, language, country_code, is_active, created_at, updated_at
      from CPQ_setup_account_context
      where is_active = true
      order by account_code
    `) as CpqAccountContextRecord[];
  }

  return (await sql`
    select id, account_code, customer_id, currency, language, country_code, is_active, created_at, updated_at
    from CPQ_setup_account_context
    order by account_code
  `) as CpqAccountContextRecord[];
}

export async function createAccountContext(input: Record<string, unknown>) {
  const accountCode = asTrimmedText(input.account_code).toUpperCase();
  const customerId = asTrimmedText(input.customer_id);
  const currency = asTrimmedText(input.currency).toUpperCase();
  const language = asTrimmedText(input.language);
  const countryCode = asTrimmedText(input.country_code).toUpperCase();

  if (!accountCode || !customerId || !currency || !language || !countryCode) {
    throw new Error('account_code, customer_id, currency, language, and country_code are required');
  }

  if (!ISO2_COUNTRY_REGEX.test(countryCode)) {
    throw new Error('country_code must be a 2-letter ISO code (for example, GB)');
  }

  const rows = (await sql`
    insert into CPQ_setup_account_context (account_code, customer_id, currency, language, country_code, is_active)
    values (${accountCode}, ${customerId}, ${currency}, ${language}, ${countryCode}, ${parseBoolean(input.is_active, true)})
    returning id, account_code, customer_id, currency, language, country_code, is_active, created_at, updated_at
  `) as CpqAccountContextRecord[];

  return rows[0];
}

export async function updateAccountContext(id: number, input: Record<string, unknown>) {
  const accountCode = asTrimmedText(input.account_code).toUpperCase();
  const customerId = asTrimmedText(input.customer_id);
  const currency = asTrimmedText(input.currency).toUpperCase();
  const language = asTrimmedText(input.language);
  const countryCode = asTrimmedText(input.country_code).toUpperCase();

  if (!accountCode || !customerId || !currency || !language || !countryCode) {
    throw new Error('account_code, customer_id, currency, language, and country_code are required');
  }

  if (!ISO2_COUNTRY_REGEX.test(countryCode)) {
    throw new Error('country_code must be a 2-letter ISO code (for example, GB)');
  }

  const rows = (await sql`
    update CPQ_setup_account_context
    set account_code = ${accountCode},
        customer_id = ${customerId},
        currency = ${currency},
        language = ${language},
        country_code = ${countryCode},
        is_active = ${parseBoolean(input.is_active, true)}
    where id = ${id}
    returning id, account_code, customer_id, currency, language, country_code, is_active, created_at, updated_at
  `) as CpqAccountContextRecord[];

  return rows[0] ?? null;
}

export async function deleteAccountContext(id: number) {
  await sql`delete from CPQ_setup_account_context where id = ${id}`;
}

export async function listRulesets(activeOnly = false) {
  if (activeOnly) {
    return (await sql`
      select id, cpq_ruleset, description, bike_type, namespace, header_id, is_active, sort_order, created_at, updated_at
      from CPQ_setup_ruleset
      where is_active = true
      order by sort_order, cpq_ruleset
    `) as CpqRulesetRecord[];
  }

  return (await sql`
    select id, cpq_ruleset, description, bike_type, namespace, header_id, is_active, sort_order, created_at, updated_at
    from CPQ_setup_ruleset
    order by sort_order, cpq_ruleset
  `) as CpqRulesetRecord[];
}

export async function createRuleset(input: Record<string, unknown>) {
  const cpqRuleset = asTrimmedText(input.cpq_ruleset);
  if (!cpqRuleset) {
    throw new Error('cpq_ruleset is required');
  }

  const rows = (await sql`
    insert into CPQ_setup_ruleset (cpq_ruleset, description, bike_type, namespace, header_id, sort_order, is_active)
    values (
      ${cpqRuleset},
      ${asTrimmedText(input.description) || null},
      ${asTrimmedText(input.bike_type) || null},
      ${asTrimmedText(input.namespace) || 'Default'},
      ${asTrimmedText(input.header_id) || 'Simulator'},
      ${Number(input.sort_order ?? 0)},
      ${parseBoolean(input.is_active, true)}
    )
    returning id, cpq_ruleset, description, bike_type, namespace, header_id, is_active, sort_order, created_at, updated_at
  `) as CpqRulesetRecord[];

  return rows[0];
}

export async function updateRuleset(id: number, input: Record<string, unknown>) {
  const cpqRuleset = asTrimmedText(input.cpq_ruleset);
  if (!cpqRuleset) {
    throw new Error('cpq_ruleset is required');
  }

  const rows = (await sql`
    update CPQ_setup_ruleset
    set cpq_ruleset = ${cpqRuleset},
        description = ${asTrimmedText(input.description) || null},
        bike_type = ${asTrimmedText(input.bike_type) || null},
        namespace = ${asTrimmedText(input.namespace) || 'Default'},
        header_id = ${asTrimmedText(input.header_id) || 'Simulator'},
        sort_order = ${Number(input.sort_order ?? 0)},
        is_active = ${parseBoolean(input.is_active, true)}
    where id = ${id}
    returning id, cpq_ruleset, description, bike_type, namespace, header_id, is_active, sort_order, created_at, updated_at
  `) as CpqRulesetRecord[];

  return rows[0] ?? null;
}

export async function deleteRuleset(id: number) {
  await sql`delete from CPQ_setup_ruleset where id = ${id}`;
}

export async function listImageManagementRows(filters: { featureLabel?: string; onlyMissingPicture?: boolean } = {}) {
  const featureLabel = asTrimmedText(filters.featureLabel);
  const onlyMissingPicture = Boolean(filters.onlyMissingPicture);

  return (await sql`
    select id, feature_label, option_label, option_value, feature_id, option_id, picture_link, is_active, created_at, updated_at
    from cpq_image_management
    where (${featureLabel} = '' or feature_label ilike ${`%${featureLabel}%`})
      and (not ${onlyMissingPicture} or picture_link is null or btrim(picture_link) = '')
    order by feature_label, option_label, option_value
  `) as CpqImageManagementRecord[];
}

export async function updateImageManagementRow(id: number, input: Record<string, unknown>) {
  const pictureLink = asNullableTrimmedText(input.picture_link);
  const isActive = parseBoolean(input.is_active, true);

  const rows = (await sql`
    update cpq_image_management
    set picture_link = ${pictureLink},
        is_active = ${isActive}
    where id = ${id}
    returning id, feature_label, option_label, option_value, feature_id, option_id, picture_link, is_active, created_at, updated_at
  `) as CpqImageManagementRecord[];

  return rows[0] ?? null;
}

export async function syncImageManagementFromSampler() {
  const insertedRows = (await sql`
    with distinct_options as (
      select distinct
        btrim(opt ->> 'featureLabel') as feature_label,
        btrim(opt ->> 'optionLabel') as option_label,
        btrim(opt ->> 'optionValue') as option_value,
        nullif(btrim(opt ->> 'featureId'), '') as feature_id,
        nullif(btrim(opt ->> 'optionId'), '') as option_id
      from CPQ_sampler_result src
      cross join lateral jsonb_array_elements(
        case
          when jsonb_typeof(src.json_result -> 'selectedOptions') = 'array' then src.json_result -> 'selectedOptions'
          else '[]'::jsonb
        end
      ) as opt
      where btrim(opt ->> 'featureLabel') <> ''
        and btrim(opt ->> 'optionLabel') <> ''
        and btrim(opt ->> 'optionValue') <> ''
    ),
    upserted as (
      insert into cpq_image_management (feature_label, option_label, option_value, feature_id, option_id)
      select feature_label, option_label, option_value, feature_id, option_id
      from distinct_options
      on conflict (feature_label, option_label, option_value) do update
      set feature_id = coalesce(cpq_image_management.feature_id, excluded.feature_id),
          option_id = coalesce(cpq_image_management.option_id, excluded.option_id)
      where cpq_image_management.feature_id is null
         or cpq_image_management.option_id is null
      returning xmax = 0 as inserted
    )
    select inserted
    from upserted
  `) as Array<{ inserted: boolean }>;

  const rows = (await sql`
    select count(*)::int as total
    from cpq_image_management
  `) as Array<{ total: number }>;

  const inserted = insertedRows.filter((row) => row.inserted).length;
  const updated = insertedRows.length - inserted;

  return {
    inserted,
    updated,
    total: rows[0]?.total ?? 0,
  };
}
