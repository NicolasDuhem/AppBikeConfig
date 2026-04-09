import { promises as fs } from 'fs';
import path from 'path';

export type ApiDocParam = {
  name: string;
  type: string;
  required: boolean;
  description: string;
};

export type ApiDocField = {
  name: string;
  type: string;
  description?: string;
};

export type ApiEndpointDoc = {
  method: 'GET';
  path: string;
  sourceFile: string;
  description: string;
  auth: string;
  queryParams: ApiDocParam[];
  responseFields: ApiDocField[];
  exampleResponse: Record<string, unknown> | Array<Record<string, unknown>>;
  includeInAdminDocs: boolean;
  exclusionReason?: string;
};

type EndpointEnrichment = Partial<Pick<ApiEndpointDoc, 'description' | 'auth' | 'queryParams' | 'responseFields' | 'exampleResponse' | 'includeInAdminDocs' | 'exclusionReason'>>;

const ENDPOINT_ENRICHMENTS: Record<string, EndpointEnrichment> = {
  '/api/cpq/generate': {
    description: 'Generate CPQ combinations from canonical import rows and generation context query parameters.',
    queryParams: [
      { name: 'selected_line', type: 'string', required: true, description: 'Product line selector. Allowed values: A Line, C Line, P Line, T Line, G Line.' },
      { name: 'electric_type', type: 'string', required: true, description: 'Electric mode. Allowed values: Electric or Non electric.' },
      { name: 'is_special', type: 'boolean|string', required: false, description: 'Special-edition toggle; true/1/yes are treated as enabled.' },
      { name: 'special_edition_name', type: 'string', required: false, description: 'Optional edition label when special mode is enabled.' },
      { name: 'character_17', type: 'string', required: false, description: 'Character 17 override (normalized to valid CPQ value).' },
      { name: 'file_name', type: 'string', required: false, description: 'Client-originated generation file name metadata.' }
    ],
    responseFields: [
      { name: 'success', type: 'boolean' },
      { name: 'phase', type: 'string' },
      { name: 'generationContext', type: 'object' },
      { name: 'rows', type: 'array<object>' },
      { name: 'diagnostics', type: 'object' },
      { name: 'error', type: 'string (error responses)' }
    ],
    exampleResponse: {
      success: true,
      phase: 'generation_completed',
      generationContext: {
        fileName: 'cpq-generate',
        selectedLine: 'C Line',
        electricType: 'Electric',
        isSpecial: false,
        character17: 'A'
      },
      rows: [
        {
          CPQRuleset: 'CPQ-ROWSET-2026',
          ProductAssist: 'Electric',
          ProductFamily: 'Bike',
          ProductLine: 'C Line',
          ProductType: 'Standard',
          ProductModel: 'Explore',
          'SKU code': 'ABCDE12345FGHIJKA'
        }
      ],
      diagnostics: {
        totalRows: 1,
        excludedRows: 0
      }
    }
  },
  '/api/cpq/options': {
    description: 'Return localized CPQ selection options sourced from active canonical cpq_import_rows data.',
    queryParams: [
      { name: 'locale', type: 'string', required: false, description: 'Preferred locale code (normalized against managed locales).' },
      { name: 'country', type: 'string', required: false, description: 'Country name used for runtime locale resolution.' },
      { name: 'country_id', type: 'number', required: false, description: 'Country id used for runtime locale resolution.' }
    ],
    responseFields: [
      { name: 'locale', type: 'string' },
      { name: 'localeSource', type: 'string' },
      { name: 'locales', type: 'array<string>' },
      { name: 'productFieldOptions', type: 'object' },
      { name: 'digitOptions', type: 'array<object>' },
      { name: 'dependencyRules', type: 'array<object>' }
    ],
    exampleResponse: {
      locale: 'en-GB',
      localeSource: 'country_locale',
      locales: ['en-GB', 'de-DE'],
      productFieldOptions: {
        productAssist: ['Electric', 'Non electric'],
        productFamily: ['Bike'],
        productLine: ['A Line', 'C Line'],
        productType: ['Standard', 'Special edition'],
        productModel: ['Explore']
      },
      digitOptions: [
        {
          digitPosition: 1,
          optionName: 'BikeType',
          isRequired: true,
          selectionMode: 'single',
          choices: [{ cpqImportRowId: 101, codeValue: 'A', choiceValue: 'Urban' }]
        }
      ],
      dependencyRules: [{ source_digit_position: 4, target_digit_position: 8, rule_type: 'match_code', active: true, sort_order: 0 }]
    }
  },
  '/api/cpq-matrix': {
    description: 'Read CPQ matrix rows, countries, and ruleset names for matrix management.',
    responseFields: [
      { name: 'countries', type: 'array<object>' },
      { name: 'rows', type: 'array<object>' },
      { name: 'rulesets', type: 'array<string>' }
    ],
    exampleResponse: {
      countries: [{ id: 1, country: 'United Kingdom', region: 'UK', brake_type: 'lr' }],
      rows: [{ id: 412, sku_code: 'ABCDE12345FGHIJKA', cpq_ruleset: 'CPQ-ROWSET-2026', availability: { 'United Kingdom': true } }],
      rulesets: ['CPQ-ROWSET-2026']
    }
  },
  '/api/feature-flags/public': {
    description: 'Expose login-scoped feature flag visibility and caller RBAC context for UI navigation.',
    auth: 'Login required (requireApiLogin)',
    responseFields: [
      { name: 'cpq_bdam_picture_picker', type: 'boolean' },
      { name: 'roles', type: 'array<string>' },
      { name: 'permissions', type: 'array<string>' }
    ],
    exampleResponse: {
      cpq_bdam_picture_picker: false,
      roles: ['sys_admin'],
      permissions: ['users.manage', 'feature_flags.manage']
    }
  },
  '/api/feature-flags': {
    description: 'Return configured feature flags for administrators.',
    responseFields: [{ name: 'rows', type: 'array<object>' }],
    exampleResponse: { rows: [{ id: 1, flag_key: 'cpq_bdam_picture_picker', enabled: false, updated_at: '2026-04-09T00:00:00.000Z' }] }
  },
  '/api/me': {
    description: 'Return current authenticated user identity plus resolved RBAC state.',
    auth: 'Login required (requireApiLogin)',
    responseFields: [
      { name: 'user', type: 'object' },
      { name: 'roles', type: 'array<string>' },
      { name: 'permissions', type: 'array<string>' }
    ],
    exampleResponse: {
      user: { id: 7, email: 'admin@example.com', is_active: true },
      roles: ['sys_admin'],
      permissions: ['users.manage', 'permissions.manage', 'feature_flags.manage']
    }
  },
  '/api/permissions': {
    description: 'List permission catalog entries.',
    responseFields: [{ name: '[]', type: 'array<{id:number,permission_key:string,permission_name:string,description:string}>' }],
    exampleResponse: [{ id: 1, permission_key: 'users.manage', permission_name: 'Manage users', description: 'Create and edit users' }]
  },
  '/api/product-setup': {
    description: 'Read SKU setup configuration and dependency rules used by generation/builder flows.',
    responseFields: [
      { name: 'digitConfigs', type: 'array<object>' },
      { name: 'dependencyRules', type: 'array<object>' },
      { name: 'availableDigits', type: 'array<object>' }
    ],
    exampleResponse: {
      digitConfigs: [{ id: 1, digit_position: 1, option_name: 'BikeType', is_required: true, selection_mode: 'single', is_active: true }],
      dependencyRules: [{ id: 1, source_digit_position: 4, target_digit_position: 8, rule_type: 'match_code', active: true, sort_order: 0, notes: null }],
      availableDigits: [{ digit_position: 1, option_name: 'BikeType' }]
    }
  },
  '/api/role-permissions': {
    description: 'Read role baseline permission assignments.',
    responseFields: [{ name: '[]', type: 'array<{role_key:string,permission_key:string}>' }],
    exampleResponse: [{ role_key: 'sys_admin', permission_key: 'users.manage' }]
  },
  '/api/roles': {
    description: 'List available application roles.',
    responseFields: [{ name: '[]', type: 'array<{id:number,role_key:string,role_name:string}>' }],
    exampleResponse: [{ id: 1, role_key: 'sys_admin', role_name: 'System Administrator' }]
  },
  '/api/sku-rule-translations': {
    description: 'Read canonical SKU rows with locale-specific translation overlay.',
    auth: 'Login required (requireApiLogin)',
    queryParams: [
      { name: 'locale', type: 'string', required: false, description: 'Locale to resolve translation rows.' },
      { name: 'include_inactive', type: '1|0', required: false, description: 'When set to 1, includes inactive canonical rows.' }
    ],
    responseFields: [
      { name: 'locale', type: 'string' },
      { name: 'locales', type: 'array<string>' },
      { name: 'rows', type: 'array<object>' }
    ],
    exampleResponse: {
      locale: 'en-GB',
      locales: ['en-GB', 'de-DE'],
      rows: [
        {
          cpq_import_row_id: 101,
          digit_position: 1,
          option_name: 'BikeType',
          code_value: 'A',
          choice_value: 'Urban',
          is_active: true,
          translated_value: 'Urban',
          translation_updated_at: '2026-04-09T00:00:00.000Z',
          translation_updated_by_email: 'admin@example.com'
        }
      ]
    }
  },
  '/api/sku-rules': {
    description: 'Read canonical cpq_import_rows SKU definition records (with optional inactive rows).',
    auth: 'Login required (requireApiLogin)',
    queryParams: [
      { name: 'include_inactive', type: '1|0', required: false, description: 'When set to 1, includes inactive canonical rows.' }
    ],
    responseFields: [
      { name: 'rows', type: 'array<object>' },
      { name: 'digitIssues', type: 'array<object>' }
    ],
    exampleResponse: {
      rows: [{ id: 101, digit_position: 1, option_name: 'BikeType', code_value: 'A', choice_value: 'Urban', is_active: true }],
      digitIssues: []
    }
  },
  '/api/users': {
    description: 'List users with assigned roles and per-user permission overrides.',
    responseFields: [{ name: '[]', type: 'array<object>' }],
    exampleResponse: [
      {
        id: 7,
        email: 'admin@example.com',
        is_active: true,
        created_at: '2026-04-09T00:00:00.000Z',
        roles: ['sys_admin'],
        user_permission_overrides: [{ permission_key: 'builder.push', granted: true }]
      }
    ]
  }
};

const EXCLUDED_ENDPOINTS: Record<string, string> = {
  '/api/auth/[...nextauth]': 'Auth framework callback/session route; internal to authentication flow and not exposed in admin docs.'
};

function routePathFromFile(apiRouteFilePath: string): string {
  const relative = path.relative(path.join(process.cwd(), 'app', 'api'), apiRouteFilePath);
  const routePath = relative.replace(/\\/g, '/').replace(/\/route\.ts$/, '');
  return `/api/${routePath}`;
}

function hasGetHandler(source: string) {
  return /export\s+async\s+function\s+GET\s*\(/.test(source) || /export\s+function\s+GET\s*\(/.test(source);
}

function extractGetBody(source: string): string {
  const marker = source.match(/export\s+(?:async\s+)?function\s+GET\s*\([^)]*\)\s*\{/);
  if (!marker || marker.index === undefined) return '';

  let cursor = marker.index + marker[0].length;
  let depth = 1;
  while (cursor < source.length && depth > 0) {
    const ch = source[cursor];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    cursor += 1;
  }

  return source.slice(marker.index + marker[0].length, cursor - 1);
}

function inferAuth(getBody: string): string {
  const roleMatch = getBody.match(/requireApiRole\('([^']+)'\)/);
  if (roleMatch) return `Permission required: ${roleMatch[1]} (requireApiRole)`;
  if (/requireApiLogin\(/.test(getBody)) return 'Login required (requireApiLogin)';
  return 'Auth requirement not inferred from handler body';
}

function inferQueryParams(getBody: string): ApiDocParam[] {
  const matches = Array.from(getBody.matchAll(/searchParams\.get\('([^']+)'\)/g)).map((match) => match[1]);
  const unique = Array.from(new Set(matches));
  return unique.map((name) => ({
    name,
    type: 'string',
    required: new RegExp(`!searchParams\\.get\\('${name}'\\)`).test(getBody),
    description: 'Derived from searchParams access in GET handler.'
  }));
}

async function collectRouteFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const routeFiles: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      routeFiles.push(...await collectRouteFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name === 'route.ts') {
      routeFiles.push(fullPath);
    }
  }

  return routeFiles;
}

export async function discoverApiGetDocs(): Promise<ApiEndpointDoc[]> {
  const apiRoot = path.join(process.cwd(), 'app', 'api');
  const files = await collectRouteFiles(apiRoot);
  const docs: ApiEndpointDoc[] = [];

  for (const file of files) {
    const source = await fs.readFile(file, 'utf8');
    const pathKey = routePathFromFile(file);

    if (EXCLUDED_ENDPOINTS[pathKey]) {
      docs.push({
        method: 'GET',
        path: pathKey,
        sourceFile: path.relative(process.cwd(), file).replace(/\\/g, '/'),
        description: 'Excluded internal endpoint.',
        auth: 'Internal',
        queryParams: [],
        responseFields: [],
        exampleResponse: {},
        includeInAdminDocs: false,
        exclusionReason: EXCLUDED_ENDPOINTS[pathKey]
      });
      continue;
    }

    if (!hasGetHandler(source)) continue;

    const getBody = extractGetBody(source);
    const enrichment = ENDPOINT_ENRICHMENTS[pathKey] || {};

    docs.push({
      method: 'GET',
      path: pathKey,
      sourceFile: path.relative(process.cwd(), file).replace(/\\/g, '/'),
      description: enrichment.description || 'GET endpoint discovered from active route handler.',
      auth: enrichment.auth || inferAuth(getBody),
      queryParams: enrichment.queryParams || inferQueryParams(getBody),
      responseFields: enrichment.responseFields || [],
      exampleResponse: enrichment.exampleResponse || {},
      includeInAdminDocs: enrichment.includeInAdminDocs ?? true,
      exclusionReason: enrichment.exclusionReason
    });
  }

  return docs.sort((a, b) => a.path.localeCompare(b.path));
}
