import { test, expect } from '@playwright/test';

test('GET /api/live returns expected structure', async ({ request }) => {
  const response = await request.get('/api/live');
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('isLive');
  expect(body).toHaveProperty('youtubeVideoId');
  expect(body).toHaveProperty('title');
  expect(typeof body.isLive).toBe('boolean');
});
