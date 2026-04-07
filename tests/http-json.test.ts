import test from 'node:test';
import assert from 'node:assert/strict';
import { safeReadJsonResponse } from '../lib/http-json.ts';

test('safeReadJsonResponse parses valid json', async () => {
  const response = new Response(JSON.stringify({ ok: false, message: 'bad' }), {
    status: 400,
    headers: { 'content-type': 'application/json' }
  });
  const payload = await safeReadJsonResponse(response);
  assert.equal(payload.message, 'bad');
});

test('safeReadJsonResponse does not throw on empty json body', async () => {
  const response = new Response('', {
    status: 500,
    headers: { 'content-type': 'application/json' }
  });
  const payload = await safeReadJsonResponse(response);
  assert.match(String(payload.message || ''), /status 500/);
});
