export type BcStatus = 'ok' | 'nok';

export type BigCommerceSkuCheckResult = {
  inputSku: string;
  found: boolean;
  bcStatus: BcStatus;
  variantId: number | null;
  productId: number | null;
  productName: string | null;
  error: string | null;
};

type BigCommerceVariant = {
  id: number;
  product_id: number;
  sku: string;
};

type BigCommerceProduct = {
  id: number;
  name: string;
};

const BC_API_VERSION = 'v3';
const MAX_RETRIES = 3;

function getBigCommerceConfig() {
  const storeHash = process.env.BIGCOMMERCE_STORE_HASH;
  const accessToken = process.env.BIGCOMMERCE_ACCESS_TOKEN;
  if (!storeHash || !accessToken) {
    throw new Error('BigCommerce credentials are not configured');
  }

  return {
    baseUrl: `https://api.bigcommerce.com/stores/${storeHash}/${BC_API_VERSION}`,
    accessToken
  };
}

async function bigCommerceFetch(path: string) {
  const { baseUrl, accessToken } = getBigCommerceConfig();
  const url = `${baseUrl}${path}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Auth-Token': accessToken,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get('x-rate-limit-time-reset-ms') || 0);
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 350 * attempt;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`BigCommerce API ${response.status}${body ? `: ${body.slice(0, 180)}` : ''}`);
    }

    return response.json();
  }

  throw new Error('BigCommerce API retries exhausted');
}

function normalizeSku(sku: string) {
  return String(sku || '').trim();
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchVariantChunkBySkus(skus: string[]) {
  if (!skus.length) return [] as BigCommerceVariant[];

  const encodedSkus = skus.map((sku) => encodeURIComponent(sku)).join(',');
  const payload = await bigCommerceFetch(`/catalog/variants?limit=${Math.max(1, skus.length)}&sku:in=${encodedSkus}&include_fields=id,product_id,sku`);
  return Array.isArray(payload?.data) ? payload.data : [];
}

async function fetchProductNames(productIds: number[]) {
  const uniqueIds = Array.from(new Set(productIds)).filter((id) => id > 0);
  if (!uniqueIds.length) return new Map<number, string>();

  const encodedIds = uniqueIds.map((id) => encodeURIComponent(String(id))).join(',');
  const payload = await bigCommerceFetch(`/catalog/products?limit=${uniqueIds.length}&id:in=${encodedIds}&include_fields=id,name`);
  const products: BigCommerceProduct[] = Array.isArray(payload?.data) ? payload.data : [];
  return new Map(products.map((product) => [Number(product.id), String(product.name || '')]));
}

export async function checkVariantSkuExists(inputSkus: string[]) {
  const normalized = Array.from(new Set(inputSkus.map(normalizeSku)));
  const nonBlankSkus = normalized.filter(Boolean);

  const defaultResults = new Map<string, BigCommerceSkuCheckResult>();
  for (const sku of normalized) {
    if (!sku) {
      defaultResults.set(sku, {
        inputSku: sku,
        found: false,
        bcStatus: 'nok',
        variantId: null,
        productId: null,
        productName: null,
        error: null
      });
    }
  }

  if (!nonBlankSkus.length) {
    return {
      results: defaultResults,
      hasGlobalError: false,
      globalErrorMessage: null
    };
  }

  try {
    const variantBySku = new Map<string, BigCommerceVariant>();
    const variantChunks = chunk(nonBlankSkus, 40);

    for (const skuChunk of variantChunks) {
      const variants = await fetchVariantChunkBySkus(skuChunk);
      for (const variant of variants) {
        const variantSku = normalizeSku(variant.sku);
        if (variantSku) {
          variantBySku.set(variantSku, { ...variant, id: Number(variant.id), product_id: Number(variant.product_id) });
        }
      }
    }

    const productNames = await fetchProductNames(Array.from(variantBySku.values()).map((variant) => variant.product_id));

    for (const sku of nonBlankSkus) {
      const variant = variantBySku.get(sku);
      defaultResults.set(sku, {
        inputSku: sku,
        found: !!variant,
        bcStatus: variant ? 'ok' : 'nok',
        variantId: variant ? Number(variant.id) : null,
        productId: variant ? Number(variant.product_id) : null,
        productName: variant ? productNames.get(Number(variant.product_id)) || null : null,
        error: null
      });
    }

    return {
      results: defaultResults,
      hasGlobalError: false,
      globalErrorMessage: null
    };
  } catch (error: any) {
    for (const sku of nonBlankSkus) {
      defaultResults.set(sku, {
        inputSku: sku,
        found: false,
        bcStatus: 'nok',
        variantId: null,
        productId: null,
        productName: null,
        error: String(error?.message || 'BigCommerce lookup failed')
      });
    }

    return {
      results: defaultResults,
      hasGlobalError: true,
      globalErrorMessage: String(error?.message || 'BigCommerce lookup failed')
    };
  }
}
