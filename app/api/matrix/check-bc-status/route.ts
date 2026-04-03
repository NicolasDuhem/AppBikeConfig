import { NextResponse } from 'next/server';
import { requireApiLogin } from '@/lib/api-auth';
import { writeAuditLog } from '@/lib/audit';
import { checkVariantSkuExists } from '@/lib/bigcommerce';
import { updateMatrixBcStatus } from '@/lib/matrix-service';

type RequestedRow = {
  id?: number;
  sku_code?: string;
};

export async function POST(request: Request) {
  const auth = await requireApiLogin();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const rows = Array.isArray(body.rows) ? (body.rows as RequestedRow[]) : [];
  if (!rows.length) {
    return NextResponse.json({ error: 'rows are required' }, { status: 400 });
  }

  const uniqueSkus = Array.from(new Set(rows.map((row) => String(row.sku_code || '').trim())));
  const lookup = await checkVariantSkuExists(uniqueSkus);

  const results = rows.map((row) => {
    const sku = String(row.sku_code || '').trim();
    const fromLookup = lookup.results.get(sku) || {
      inputSku: sku,
      found: false,
      bcStatus: 'nok' as const,
      variantId: null,
      productId: null,
      productName: null,
      error: sku ? 'No lookup result for SKU' : null
    };

    return {
      rowId: Number(row.id || 0) || null,
      ...fromLookup
    };
  });

  const persistable = results
    .filter((result) => result.rowId && !result.error)
    .map((result) => ({ productId: Number(result.rowId), bcStatus: result.bcStatus }));

  if (persistable.length) {
    await updateMatrixBcStatus(persistable);
  }

  const summary = {
    checked: results.length,
    found: results.filter((r) => r.found).length,
    notFound: results.filter((r) => !r.found && !r.error).length,
    failed: results.filter((r) => !!r.error).length,
    persisted: persistable.length,
    scope: String(body.scope || 'working_set')
  };

  await writeAuditLog({
    userId: auth.user.id,
    actionKey: 'matrix.view',
    entityType: 'bigcommerce_variant_check',
    newData: {
      summary,
      hasGlobalError: lookup.hasGlobalError,
      globalErrorMessage: lookup.globalErrorMessage
    }
  });

  return NextResponse.json({
    ok: !lookup.hasGlobalError,
    summary,
    hasGlobalError: lookup.hasGlobalError,
    globalErrorMessage: lookup.globalErrorMessage,
    results
  }, { status: lookup.hasGlobalError ? 207 : 200 });
}
