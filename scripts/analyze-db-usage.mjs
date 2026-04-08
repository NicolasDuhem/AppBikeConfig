#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const TARGETS = ['app', 'lib', 'sql'];
const DOC_PATH = path.join(ROOT, 'docs/generated/db-usage-report.md');
const JSON_PATH = path.join(ROOT, 'docs/database-runtime-inventory.json');

const allowList = new Set([
  'products','countries','availability','setup_options','sku_rules',
  'app_users','roles','user_roles','permissions','role_permissions','user_permissions','audit_log',
  'feature_flags','feature_flag_audit','cpq_import_runs','cpq_import_rows','cpq_products','cpq_product_attributes','cpq_products_flat',
  'cpq_sku_rules','cpq_countries','cpq_availability','cpq_product_assets','cpq_import_row_translations',
  'sku_digit_option_config','sku_generation_dependency_rules','role_permission_baselines_audit'
]);

function listFiles() {
  const cmd = `rg --files ${TARGETS.map((t) => `'${t}'`).join(' ')}`;
  return execSync(cmd, { encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean);
}

function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }

const queryRegex = /\b(from|join|into|update|delete\s+from)\s+([a-zA-Z_][a-zA-Z0-9_\.]*)(?!\s*\()/gi;
const sqlTemplateRegex = /sql`([\s\S]*?)`/g;
const tableHits = new Map();

for (const file of listFiles()) {
  const text = read(file);
  const snippets = file.endsWith('.sql') ? [text] : Array.from(text.matchAll(sqlTemplateRegex)).map((m) => m[1]);
  for (const snippet of snippets) {
    let match;
    while ((match = queryRegex.exec(snippet))) {
      const table = match[2].split('.').pop().toLowerCase();
      if (!allowList.has(table)) continue;
      if (!tableHits.has(table)) tableHits.set(table, new Set());
      tableHits.get(table).add(file);
    }
  }
}

const sorted = Array.from(tableHits.entries()).sort((a, b) => a[0].localeCompare(b[0]));

const md = [
  '# Generated DB usage report',
  '',
  `Generated at: ${new Date().toISOString()}`,
  '',
  '> Heuristic scan of SQL table/view names found in app/lib/sql source files. Manual docs remain authoritative.',
  '',
  '| Object | File references |',
  '|---|---|'
];
for (const [table, files] of sorted) {
  md.push(`| \`${table}\` | ${Array.from(files).sort().map((f) => `\`${f}\``).join('<br>')} |`);
}
md.push('');
fs.writeFileSync(DOC_PATH, md.join('\n'));

const inventory = {
  generated_at: new Date().toISOString(),
  object_count: sorted.length,
  objects: sorted.map(([table, files]) => ({ object: table, discovered_from: Array.from(files).sort() }))
};
fs.writeFileSync(JSON_PATH, JSON.stringify(inventory, null, 2) + '\n');

console.log(`Wrote ${path.relative(ROOT, DOC_PATH)} and ${path.relative(ROOT, JSON_PATH)}`);
