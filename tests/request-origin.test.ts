import test from 'node:test';
import assert from 'node:assert/strict';

import { getRequestOrigin } from '../lib/server/requestOrigin';

test('getRequestOrigin prefers forwarded headers from the proxy', () => {
  const request = new Request('http://internal-host.local/api/test', {
    headers: {
      'x-forwarded-host': 'app.example.com',
      'x-forwarded-proto': 'https',
    },
  });

  assert.equal(getRequestOrigin(request), 'https://app.example.com');
});

test('getRequestOrigin falls back to the request url origin', () => {
  const request = new Request('https://pawny.test/api/test');
  assert.equal(getRequestOrigin(request), 'https://pawny.test');
});
