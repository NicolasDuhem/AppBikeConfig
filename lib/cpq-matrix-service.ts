import { sql } from '@/lib/db';
import type { BrakeType } from '@/lib/types';
import { brakeTypesMatch, isValidBrakeType } from '@/lib/cpq-matrix-utils';

export type CpqMatrixProductInput = {
  cpq_rule_id?: number;
  sku_code?: string;
  cpq_ruleset?: string;
  brake_type?: BrakeType;
  handlebar?: string;
  speed?: string;
  rack?: string;
  bike_type?: string;
  colour?: string;
  light?: string;
  seatpost_length?: string;
  saddle?: string;
  description?: string;
  bc_status?: 'ok' | 'nok' | '';
};

export async function getCpqCountries() {
  return await sql`select id, country, region, brake_type from cpq_countries order by region, country`;
}

export async function upsertCpqMatrixProduct(product: CpqMatrixProductInput, availability: Record<string, boolean>) {
  const cpqRuleId = Number(product.cpq_rule_id || 0);
  const skuCode = String(product.sku_code || '').trim();
  const cpqRuleset = String(product.cpq_ruleset || '').trim();
  const brakeType = String(product.brake_type || '').trim();

  if (!skuCode) return { ok: false as const, error: 'sku_code is required' };
  if (!cpqRuleset) return { ok: false as const, error: 'cpq_ruleset is required' };
  if (!isValidBrakeType(brakeType)) return { ok: false as const, error: 'brake_type must be reverse or non_reverse' };

  const oldProduct = cpqRuleId ? ((await sql`select * from cpq_sku_rules where id = ${cpqRuleId}` as any[])[0] || null) : null;
  let ruleId = cpqRuleId;

  try {
    if (ruleId) {
      const duplicate = await sql`
        select id
        from cpq_sku_rules
        where id <> ${ruleId}
          and is_active = true
          and lower(sku_code) = lower(${skuCode})
          and lower(cpq_ruleset) = lower(${cpqRuleset})
          and brake_type = ${brakeType}
        limit 1
      ` as any[];
      if (duplicate.length) {
        return { ok: false as const, error: `Active duplicate exists for sku ${skuCode}, ruleset ${cpqRuleset}, brake type ${brakeType}` };
      }

      const updated = await sql`
        update cpq_sku_rules set
          sku_code = ${skuCode},
          cpq_ruleset = ${cpqRuleset},
          brake_type = ${brakeType},
          handlebar = ${String(product.handlebar || '')},
          speed = ${String(product.speed || '')},
          rack = ${String(product.rack || '')},
          bike_type = ${String(product.bike_type || '')},
          colour = ${String(product.colour || '')},
          light = ${String(product.light || '')},
          seatpost_length = ${String(product.seatpost_length || '')},
          saddle = ${String(product.saddle || '')},
          description = ${String(product.description || '')},
          bc_status = ${String(product.bc_status || '')},
          updated_at = now()
        where id = ${ruleId}
        returning id
      ` as any[];
      if (!updated.length) return { ok: false as const, error: `CPQ row ${ruleId} not found` };
    } else {
      const duplicate = await sql`
        select id
        from cpq_sku_rules
        where is_active = true
          and lower(sku_code) = lower(${skuCode})
          and lower(cpq_ruleset) = lower(${cpqRuleset})
          and brake_type = ${brakeType}
        limit 1
      ` as any[];
      if (duplicate.length) {
        return { ok: false as const, error: `Active duplicate exists for sku ${skuCode}, ruleset ${cpqRuleset}, brake type ${brakeType}` };
      }

      const inserted = await sql`
        insert into cpq_sku_rules (sku_code, cpq_ruleset, brake_type, handlebar, speed, rack, bike_type, colour, light, seatpost_length, saddle, description, bc_status)
        values (${skuCode}, ${cpqRuleset}, ${brakeType}, ${String(product.handlebar || '')}, ${String(product.speed || '')}, ${String(product.rack || '')}, ${String(product.bike_type || '')}, ${String(product.colour || '')}, ${String(product.light || '')}, ${String(product.seatpost_length || '')}, ${String(product.saddle || '')}, ${String(product.description || '')}, ${String(product.bc_status || '')})
        returning id
      ` as any[];
      ruleId = Number(inserted[0].id);
    }
  } catch {
    return { ok: false as const, error: 'Failed to save CPQ row' };
  }

  const countries = await getCpqCountries();
  for (const country of countries as any[]) {
    if (!(country.country in availability)) continue;
    if (!brakeTypesMatch(brakeType, country.brake_type) && !!availability[country.country]) {
      return { ok: false as const, error: `Country ${country.country} is ${country.brake_type} and cannot be assigned to ${brakeType} SKU` };
    }

    await sql`
      insert into cpq_availability (cpq_sku_rule_id, cpq_country_id, available, updated_at)
      values (${ruleId}, ${country.id}, ${!!availability[country.country]}, now())
      on conflict (cpq_sku_rule_id, cpq_country_id)
      do update set available = excluded.available, updated_at = now()
    `;
  }

  const newProduct = (await sql`select * from cpq_sku_rules where id = ${ruleId}` as any[])[0];
  return { ok: true as const, cpqRuleId: ruleId, oldProduct, newProduct };
}

export async function updateCpqMatrixBcStatus(updates: Array<{ cpqRuleId: number; bcStatus: 'ok' | 'nok' }>) {
  for (const update of updates) {
    await sql`
      update cpq_sku_rules
      set bc_status = ${update.bcStatus}, updated_at = now()
      where id = ${update.cpqRuleId}
    `;
  }
}
