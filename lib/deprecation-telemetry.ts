import { writeAuditLog } from '@/lib/audit';

export const LEGACY_PATH_KEYS = {
  matrixRead: 'legacy.matrix.read',
  matrixWrite: 'legacy.matrix.write',
  matrixSaveAll: 'legacy.matrix.save_all',
  matrixBulkUpdate: 'legacy.matrix.bulk_update',
  matrixCheckBcStatus: 'legacy.matrix.check_bc_status',
  builderPush: 'legacy.builder_push',
  setupOptionsRead: 'legacy.setup_options.read',
  setupOptionsWrite: 'legacy.setup_options.write',
  setupOptionsDelete: 'legacy.setup_options.delete',
  countriesRead: 'legacy.countries.read',
  countriesWrite: 'legacy.countries.write',
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
 * @deprecated Compatibility-path telemetry helper.
 * Keep legacy instrumentation centralized here so removal is a single delete pass
 * once deprecation gates are satisfied.
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
