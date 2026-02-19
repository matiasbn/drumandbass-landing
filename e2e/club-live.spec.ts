import { test, expect, Page, BrowserContext } from '@playwright/test';

const PROJECT_REF = 'osbvoexqqrptbthvqvkx';

const fakeSession = {
  access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlLXVzZXItaWQiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImV4cCI6OTk5OTk5OTk5OX0.fake',
  refresh_token: 'fake-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: {
    id: 'fake-user-id',
    email: 'test@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    created_at: '2024-01-01T00:00:00Z',
    app_metadata: { provider: 'google' },
    user_metadata: { full_name: 'Test User' },
  },
};

const fakeProfile = {
  id: 'p1',
  user_id: 'fake-user-id',
  name: 'Test User',
  username: 'testuser',
  email: 'test@example.com',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

/**
 * Bypass Supabase auth + YouTube subscribe screen for club tests
 */
async function setupClubAuth(page: Page, context: BrowserContext) {
  await context.addCookies([
    {
      name: `sb-${PROJECT_REF}-auth-token`,
      value: JSON.stringify(fakeSession),
      domain: 'localhost',
      path: '/',
    },
  ]);

  await page.addInitScript(() => {
    localStorage.setItem('yt_sub_fake-user-id', '1');
    localStorage.setItem('dnbchile_username', 'testuser');
  });

  await page.route(`https://${PROJECT_REF}.supabase.co/auth/v1/**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fakeSession),
    })
  );

  await page.route(`https://${PROJECT_REF}.supabase.co/realtime/**`, (route) =>
    route.abort()
  );

  await page.route('/api/profile', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ profile: fakeProfile }),
    })
  );
}

test.describe('Club Live Screen', () => {
  test('shows LIVE indicator and loads club scene when stream is active', async ({ page, context }) => {
    await setupClubAuth(page, context);

    await page.route('/api/live', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isLive: true,
          youtubeVideoId: 'dQw4w9WgXcQ',
          title: 'Test Live Stream',
        }),
      })
    );

    await page.goto('/club');

    // Club scene loaded (past auth + subscribe screens)
    await expect(page.locator('text=SALIR')).toBeVisible({ timeout: 20000 });

    // LIVE indicator with title
    await expect(page.locator('text=LIVE: Test Live Stream')).toBeVisible();

    // 3D canvas is present
    await expect(page.locator('canvas')).toBeVisible();

    // Note: the YouTube iframe is rendered via drei <Html> inside the 3D canvas.
    // It only mounts when WebGL is actively rendering, so it can't be verified
    // in headless mode. Visual verification must be done manually in a browser.
  });

  test('nav buttons are clickable on mobile when live stream is active', async ({ page, context }) => {
    await setupClubAuth(page, context);

    await page.route('/api/live', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isLive: true,
          youtubeVideoId: 'dQw4w9WgXcQ',
          title: 'Test Live Stream',
        }),
      })
    );

    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/club');

    const salirButton = page.locator('text=SALIR');
    await expect(salirButton).toBeVisible({ timeout: 20000 });

    // Verify SALIR button is clickable (not covered by iframe)
    // force: false ensures it fails if the element is obscured
    await salirButton.click({ timeout: 5000 });
  });

  test('does not show LIVE indicator when no live stream', async ({ page, context }) => {
    await setupClubAuth(page, context);

    await page.route('/api/live', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isLive: false,
          youtubeVideoId: null,
          title: null,
        }),
      })
    );

    await page.goto('/club');

    // Club scene loaded
    await expect(page.locator('text=SALIR')).toBeVisible({ timeout: 20000 });

    // No LIVE indicator
    await expect(page.locator('text=LIVE:')).toHaveCount(0);
  });
});
