import { writeAuditLog } from '@/lib/audit';

export const LEGACY_PATH_KEYS = {
  cpqImportRunsGenerateGet: 'cpq.import_runs.generate_get'
} as const;

type LegacyTelemetryInput = {
  pathKey: string;
  route: string;
  method: string;
  userId?: number | null;
  details?: Record<string, unknown>;
};

/**
 * Transitional telemetry helper for non-runtime-critical diagnostics paths.
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
