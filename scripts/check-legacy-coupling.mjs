#!/usr/bin/env node
import { execSync } from 'node:child_process';

const baseRef = process.env.LEGACY_GOV_BASE_REF || 'HEAD~1';
const targetGlobs = ['app/**/*.ts', 'app/**/*.tsx', 'lib/**/*.ts', 'sql/**/*.sql'];

const legacyPatterns = [
  '/api/matrix',
  '/api/builder-push',
  '/api/setup-options',
  '/api/countries',
  'products',
  'countries',
  'availability',
  'setup_options',
  'sku_rules'
];

function getAddedLines() {
  const out = execSync(
    `git diff -U0 ${baseRef}...HEAD -- ${targetGlobs.map((g) => `'${g}'`).join(' ')}`,
    { encoding: 'utf8' }
  );
  return out.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++'));
}

const matches = [];
for (const line of getAddedLines()) {
  const hit = legacyPatterns.find((pattern) => line.toLowerCase().includes(pattern.toLowerCase()));
  if (!hit) continue;
  if (line.includes('LEGACY_PATH_KEYS') || line.includes('@deprecated') || line.includes('trackLegacyPathInvocation')) continue;
  matches.push({ pattern: hit, line });
}

if (matches.length) {
  console.error('Legacy coupling check failed.');
  console.error(`Compared range: ${baseRef}...HEAD`);
  console.error('New legacy references were added. Prefer CPQ canonical paths unless this is explicit deprecation work.');
  for (const match of matches.slice(0, 40)) {
    console.error(`- [${match.pattern}] ${match.line}`);
  }
  process.exit(1);
}

console.log('Legacy coupling check passed.');
console.log(`Compared range: ${baseRef}...HEAD`);
