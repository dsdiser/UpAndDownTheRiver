import { describe, test, expect } from 'vitest';
import { apiApp } from '../web-server';

describe('web-server', () => {
  test('GET /ping is ok', async () => {
    const res = await apiApp.request('/ping');
    expect(res.status).toBe(200);
  });
});
