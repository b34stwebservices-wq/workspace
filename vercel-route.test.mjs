import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));

test('Vercel routes keep /api/* away from the SPA fallback', () => {
  const routes = Array.isArray(config.routes) ? config.routes : [];
  assert.ok(routes.some((route) => route.src === '/api/(.*)'), 'API routes must be defined before the SPA fallback.');
  const apiIndex = routes.findIndex((route) => route.src === '/api/(.*)');
  const spaIndex = routes.findIndex((route) => route.src === '/(.*)');
  assert.ok(apiIndex >= 0, 'Expected an API routing rule.');
  assert.ok(spaIndex >= 0, 'Expected a SPA fallback route.');
  assert.ok(apiIndex < spaIndex, 'The API route must be evaluated before the SPA fallback.');
});
