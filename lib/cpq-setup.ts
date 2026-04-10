import { sql } from '@/lib/db';

export type CpqAccountContextRecord = {
  id: number;
  account_code: string;
  customer_id: string;
  currency: string;
  language: string;
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

const parseBoolean = (value: unknown, fallback = true) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return fallback;
};

const asTrimmedText = (value: unknown) => String(value ?? '').trim();

export async function listAccountContexts(activeOnly = false) {
  if (activeOnly) {
    return (await sql`
      select id, account_code, customer_id, currency, language, is_active, created_at, updated_at
      from CPQ_setup_account_context
      where is_active = true
      order by account_code
    `) as CpqAccountContextRecord[];
  }

  return (await sql`
    select id, account_code, customer_id, currency, language, is_active, created_at, updated_at
    from CPQ_setup_account_context
    order by account_code
  `) as CpqAccountContextRecord[];
}

export async function createAccountContext(input: Record<string, unknown>) {
  const accountCode = asTrimmedText(input.account_code).toUpperCase();
  const customerId = asTrimmedText(input.customer_id);
  const currency = asTrimmedText(input.currency).toUpperCase();
  const language = asTrimmedText(input.language);

  if (!accountCode || !customerId || !currency || !language) {
    throw new Error('account_code, customer_id, currency, and language are required');
  }

  const rows = (await sql`
    insert into CPQ_setup_account_context (account_code, customer_id, currency, language, is_active)
    values (${accountCode}, ${customerId}, ${currency}, ${language}, ${parseBoolean(input.is_active, true)})
    returning id, account_code, customer_id, currency, language, is_active, created_at, updated_at
  `) as CpqAccountContextRecord[];

  return rows[0];
}

export async function updateAccountContext(id: number, input: Record<string, unknown>) {
  const accountCode = asTrimmedText(input.account_code).toUpperCase();
  const customerId = asTrimmedText(input.customer_id);
  const currency = asTrimmedText(input.currency).toUpperCase();
  const language = asTrimmedText(input.language);

  if (!accountCode || !customerId || !currency || !language) {
    throw new Error('account_code, customer_id, currency, and language are required');
  }

  const rows = (await sql`
    update CPQ_setup_account_context
    set account_code = ${accountCode},
        customer_id = ${customerId},
        currency = ${currency},
        language = ${language},
        is_active = ${parseBoolean(input.is_active, true)}
    where id = ${id}
    returning id, account_code, customer_id, currency, language, is_active, created_at, updated_at
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
