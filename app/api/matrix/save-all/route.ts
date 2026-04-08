import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { upsertMatrixProduct } from '@/lib/matrix-service';
import { writeAuditLog } from '@/lib/audit';
import { trackLegacyPathInvocation } from '@/lib/deprecation-telemetry';

export async function POST(request: Request) {
  const auth = await requireApiRole('matrix.update.single');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) {
    return NextResponse.json({ error: 'No rows to save' }, { status: 400 });
  }

  await trackLegacyPathInvocation({ pathKey: 'legacy.matrix.save_all', route: '/api/matrix/save-all', method: 'POST', userId: auth.user.id, details: { attempted: rows.length } });

  const failures: Array<{ rowKey: string; sku_code: string; reason: string }> = [];
  const successes: Array<{ id: number; sku_code: string }> = [];

  for (const row of rows) {
    const rowKey = String(row.rowKey || row.id || row.sku_code || 'new-row');
    const result = await upsertMatrixProduct(row.product || {}, row.availability || {});
    if (!result.ok) {
      failures.push({ rowKey, sku_code: String(row.product?.sku_code || ''), reason: result.error });
      continue;
    }
    successes.push({ id: result.productId, sku_code: String(row.product?.sku_code || '') });
  }

  await writeAuditLog({
    userId: auth.user.id,
    actionKey: 'matrix.update.single',
    entityType: 'product_batch',
    newData: {
      attempted: rows.length,
      succeeded: successes.length,
      failed: failures.length,
      failures
    }
  });

  return NextResponse.json({
    ok: failures.length === 0,
    mode: 'partial-success',
    attempted: rows.length,
    succeeded: successes.length,
    failed: failures.length,
    failures,
    successes
  }, { status: failures.length ? 207 : 200 });
}
