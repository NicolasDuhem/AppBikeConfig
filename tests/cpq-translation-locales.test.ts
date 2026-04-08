import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLocale, resolveManagedLocale } from '../lib/cpq-translation-locales.ts';

test('normalizeLocale trims input and handles empty values', () => {
  assert.equal(normalizeLocale(' fr-FR '), 'fr-FR');
  assert.equal(normalizeLocale('   '), '');
  assert.equal(normalizeLocale(''), '');
});

test('resolveManagedLocale falls back to first configured locale', () => {
  const result = resolveManagedLocale('de-DE', ['fr-FR', 'nl-NL']);
  assert.equal(result.locale, 'fr-FR');
  assert.deepEqual(result.locales, ['fr-FR', 'nl-NL']);
});

test('resolveManagedLocale defaults to en-US when locale catalog is empty', () => {
  const result = resolveManagedLocale('', []);
  assert.equal(result.locale, 'en-US');
  assert.deepEqual(result.locales, ['en-US']);
});
