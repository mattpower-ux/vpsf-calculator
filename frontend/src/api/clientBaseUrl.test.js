import test from 'node:test';
import assert from 'node:assert/strict';
import * as client from './client.js';

test('static calculator builds default to the hosted API while development uses the local API', () => {
  assert.equal(typeof client.resolveApiBaseUrl, 'function');
  assert.equal(client.resolveApiBaseUrl('', false), 'https://vpsf-api.onrender.com');
  assert.equal(client.resolveApiBaseUrl('', true), 'http://localhost:8000');
  assert.equal(client.resolveApiBaseUrl('https://api.example.test', false), 'https://api.example.test');
});
