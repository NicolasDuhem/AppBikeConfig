import { sql } from '@/lib/db';

export async function writeAuditLog(input: {
  userId?: number | null;
  actionKey: string;
  entityType: string;
  entityId?: string | null;
  oldData?: unknown;
  newData?: unknown;
}) {
  await sql`
    insert into audit_log (user_id, action_key, entity_type, entity_id, old_data, new_data)
    values (
      ${input.userId ?? null},
      ${input.actionKey},
      ${input.entityType},
      ${input.entityId ?? null},
      ${input.oldData ? JSON.stringify(input.oldData) : null}::jsonb,
      ${input.newData ? JSON.stringify(input.newData) : null}::jsonb
    )
  `;
}
