#!/usr/bin/env node
import { execSync } from 'node:child_process';

const baseRef = process.env.DOC_GOV_BASE_REF || 'HEAD~1';

function getChanged() {
  const out = execSync(`git diff --name-only ${baseRef}...HEAD`, { encoding: 'utf8' });
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

const changed = getChanged();
const touchedDataCode = changed.some((f) => /^(app\/api\/|lib\/|sql\/)/.test(f));
const touchedDocs = changed.some((f) => ['DATABASE.md', 'PROCESSDATA.md'].includes(f));

if (touchedDataCode && !touchedDocs) {
  console.error('Documentation governance check failed.');
  console.error('Detected DB/process code changes without updating DATABASE.md and PROCESSDATA.md.');
  console.error(`Compared range: ${baseRef}...HEAD`);
  process.exit(1);
}

console.log('Documentation governance check passed.');
console.log(`Compared range: ${baseRef}...HEAD`);
