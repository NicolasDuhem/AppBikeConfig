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

const ADMIN_GET_ENDPOINT_REGISTRY: readonly ApiEndpointDoc[] = [
  {
    method: 'GET',
    path: '/api/cpq/generate',
    sourceFile: 'app/api/cpq/generate/route.ts',
    description: 'Generate CPQ combinations from canonical import rows and generation context query parameters.',
    auth: 'Permission required: builder.use (requireApiRole)',
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
    },
    includeInAdminDocs: true
  },
  {
    method: 'GET',
    path: '/api/cpq/options',
    sourceFile: 'app/api/cpq/options/route.ts',
    description: 'Return localized CPQ selection options sourced from active canonical cpq_import_rows data.',
    auth: 'Permission required: builder.use (requireApiRole)',
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
    },
    includeInAdminDocs: true
  },
  {
    method: 'GET',
    path: '/api/cpq-matrix',
    sourceFile: 'app/api/cpq-matrix/route.ts',
    description: 'Read CPQ matrix rows, countries, and ruleset names for matrix management.',
    auth: 'Login required (requireApiLogin)',
    queryParams: [],
    responseFields: [
      { name: 'countries', type: 'array<object>' },
      { name: 'rows', type: 'array<object>' },
      { name: 'rulesets', type: 'array<string>' }
    ],
    exampleResponse: {
      countries: [{ id: 1, country: 'United Kingdom', region: 'UK', brake_type: 'lr' }],
      rows: [{ id: 412, sku_code: 'ABCDE12345FGHIJKA', cpq_ruleset: 'CPQ-ROWSET-2026', availability: { 'United Kingdom': true } }],
      rulesets: ['CPQ-ROWSET-2026']
    },
    includeInAdminDocs: true
  },
  {
    method: 'GET',
    path: '/api/feature-flags',
    sourceFile: 'app/api/feature-flags/route.ts',
    description: 'Return configured feature flags for administrators.',
    auth: 'Permission required: feature_flags.manage (requireApiRole)',
    queryParams: [],
    responseFields: [{ name: 'rows', type: 'array<object>' }],
    exampleResponse: { rows: [{ id: 1, flag_key: 'cpq_bdam_picture_picker', enabled: false, updated_at: '2026-04-09T00:00:00.000Z' }] },
    includeInAdminDocs: true
  },
  {
    method: 'GET',
    path: '/api/feature-flags/public',
    sourceFile: 'app/api/feature-flags/public/route.ts',
    description: 'Expose login-scoped feature flag visibility and caller RBAC context for UI navigation.',
    auth: 'Login required (requireApiLogin)',
    queryParams: [],
    responseFields: [
      { name: 'cpq_bdam_picture_picker', type: 'boolean' },
      { name: 'roles', type: 'array<string>' },
      { name: 'permissions', type: 'array<string>' }
    ],
    exampleResponse: {
      cpq_bdam_picture_picker: false,
      roles: ['sys_admin'],
      permissions: ['users.manage', 'feature_flags.manage']
    },
    includeInAdminDocs: true
  },
  {
    method: 'GET',
    path: '/api/me',
    sourceFile: 'app/api/me/route.ts',
    description: 'Return current authenticated user identity plus resolved RBAC state.',
    auth: 'Login required (requireApiLogin)',
    queryParams: [],
    responseFields: [
      { name: 'user', type: 'object' },
      { name: 'roles', type: 'array<string>' },
      { name: 'permissions', type: 'array<string>' }
    ],
    exampleResponse: {
      user: { id: 7, email: 'admin@example.com', is_active: true },
      roles: ['sys_admin'],
      permissions: ['users.manage', 'permissions.manage', 'feature_flags.manage']
    },
    includeInAdminDocs: true
  },
  {
    method: 'GET',
    path: '/api/permissions',
    sourceFile: 'app/api/permissions/route.ts',
    description: 'List permission catalog entries.',
    auth: 'Permission required: permissions.manage (requireApiRole)',
    queryParams: [],
    responseFields: [{ name: '[]', type: 'array<{id:number,permission_key:string,permission_name:string,description:string}>' }],
    exampleResponse: [{ id: 1, permission_key: 'users.manage', permission_name: 'Manage users', description: 'Create and edit users' }],
    includeInAdminDocs: true
  },
  {
    method: 'GET',
    path: '/api/product-setup',
    sourceFile: 'app/api/product-setup/route.ts',
    description: 'Read SKU setup configuration and dependency rules used by generation/builder flows.',
    auth: 'Permission required: builder.use (requireApiRole)',
    queryParams: [],
    responseFields: [
      { name: 'digitConfigs', type: 'array<object>' },
      { name: 'dependencyRules', type: 'array<object>' },
      { name: 'availableDigits', type: 'array<object>' }
    ],
    exampleResponse: {
      digitConfigs: [{ id: 1, digit_position: 1, option_name: 'BikeType', is_required: true, selection_mode: 'single', is_active: true }],
      dependencyRules: [{ id: 1, source_digit_position: 4, target_digit_position: 8, rule_type: 'match_code', active: true, sort_order: 0, notes: null }],
      availableDigits: [{ digit_position: 1, option_name: 'BikeType' }]
    },
    includeInAdminDocs: true
  },
  {
    method: 'GET',
    path: '/api/role-permissions',
    sourceFile: 'app/api/role-permissions/route.ts',
    description: 'Read role baseline permission assignments.',
    auth: 'Permission required: permissions.manage (requireApiRole)',
    queryParams: [],
    responseFields: [{ name: '[]', type: 'array<{role_key:string,permission_key:string}>' }],
    exampleResponse: [{ role_key: 'sys_admin', permission_key: 'users.manage' }],
    includeInAdminDocs: true
  },
  {
    method: 'GET',
    path: '/api/roles',
    sourceFile: 'app/api/roles/route.ts',
    description: 'List available application roles.',
    auth: 'Permission required: users.manage (requireApiRole)',
    queryParams: [],
    responseFields: [{ name: '[]', type: 'array<{id:number,role_key:string,role_name:string}>' }],
    exampleResponse: [{ id: 1, role_key: 'sys_admin', role_name: 'System Administrator' }],
    includeInAdminDocs: true
  },
  {
    method: 'GET',
    path: '/api/sku-rule-translations',
    sourceFile: 'app/api/sku-rule-translations/route.ts',
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
    },
    includeInAdminDocs: true
  },
  {
    method: 'GET',
    path: '/api/sku-rules',
    sourceFile: 'app/api/sku-rules/route.ts',
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
    },
    includeInAdminDocs: true
  },
  {
    method: 'GET',
    path: '/api/users',
    sourceFile: 'app/api/users/route.ts',
    description: 'List users with assigned roles and per-user permission overrides.',
    auth: 'Permission required: users.manage (requireApiRole)',
    queryParams: [],
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
    ],
    includeInAdminDocs: true
  },
  {
    method: 'GET',
    path: '/api/auth/[...nextauth]',
    sourceFile: 'app/api/auth/[...nextauth]/route.ts',
    description: 'Excluded internal endpoint.',
    auth: 'Internal',
    queryParams: [],
    responseFields: [],
    exampleResponse: {},
    includeInAdminDocs: false,
    exclusionReason: 'Auth framework callback/session route; internal to authentication flow and not exposed in admin docs.'
  }
] as const;

export async function discoverApiGetDocs(): Promise<ApiEndpointDoc[]> {
  return [...ADMIN_GET_ENDPOINT_REGISTRY].sort((a, b) => a.path.localeCompare(b.path));
}
