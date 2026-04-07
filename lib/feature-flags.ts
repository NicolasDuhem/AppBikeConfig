import { sql } from '@/lib/db';

export const IMPORT_CPQ_FLAG_KEY = 'import_csv_cpq';
export const CPQ_BDAM_PICTURE_PICKER_FLAG_KEY = 'cpq_bdam_picture_picker';

export type FeatureFlagRow = {
  id: number;
  flag_key: string;
  flag_name: string;
  description: string;
  enabled: boolean;
  updated_at: string;
  updated_by: number | null;
  updated_by_email: string | null;
};

export async function getFeatureFlags() {
  const rows = await sql`
    select
      f.id,
      f.flag_key,
      f.flag_name,
      f.description,
      f.enabled,
      f.updated_at,
      f.updated_by,
      u.email as updated_by_email
    from feature_flags f
    left join app_users u on u.id = f.updated_by
    order by f.flag_name
  ` as any[];
  return rows as FeatureFlagRow[];
}

export async function isFeatureEnabled(flagKey: string) {
  const rows = await sql`select enabled from feature_flags where flag_key = ${flagKey} limit 1` as any[];
  return !!rows[0]?.enabled;
}
