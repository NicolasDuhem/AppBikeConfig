import { writeAuditLog } from '@/lib/audit';

type LegacyTelemetryInput = {
  pathKey: string;
  route: string;
  method: string;
  userId?: number | null;
  details?: Record<string, unknown>;
};

/**
 * Lightweight telemetry for deprecation-candidate runtime paths.
 * Writes only to audit_log so no schema migration is required.
 */
export async function trackLegacyPathInvocation(input: LegacyTelemetryInput) {
  await writeAuditLog({
    userId: input.userId ?? null,
    actionKey: 'deprecation.path_invoked',
    entityType: 'legacy_runtime_path',
    entityId: input.pathKey,
    newData: {
      route: input.route,
      method: input.method,
      observed_at: new Date().toISOString(),
      ...(input.details || {})
    }
  });
}
