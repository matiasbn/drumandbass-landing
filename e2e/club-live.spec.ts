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
  // Set Supabase auth cookie
  await context.addCookies([
    {
      name: `sb-${PROJECT_REF}-auth-token`,
      value: JSON.stringify(fakeSession),
      domain: 'localhost',
      path: '/',
    },
  ]);

  // Set localStorage to bypass YouTube subscribe screen
  await page.addInitScript(() => {
    localStorage.setItem('yt_sub_fake-user-id', '1');
    localStorage.setItem('dnbchile_username', 'testuser');
  });

  // Mock Supabase auth refresh
  await page.route(`https://${PROJECT_REF}.supabase.co/auth/v1/**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fakeSession),
    })
  );

  // Mock Supabase realtime
  await page.route(`https://${PROJECT_REF}.supabase.co/realtime/**`, (route) =>
    route.abort()
  );

  // Mock profile API
  await page.route('/api/profile', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ profile: fakeProfile }),
    })
  );
}

test.describe('Club Live Screen', () => {
  test('shows YouTube panel when live stream is active', async ({ page, context }) => {
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

    // Verify the club scene loaded (SALIR button visible)
    await expect(page.locator('text=SALIR')).toBeVisible({ timeout: 20000 });

    // Verify YouTube panel appears
    const panel = page.getByTestId('youtube-panel');
    await expect(panel).toBeVisible();

    // Verify iframe with correct video ID
    const iframe = panel.locator('iframe[src*="youtube.com/embed/dQw4w9WgXcQ"]');
    await expect(iframe).toBeVisible();

    // Verify LIVE title
    await expect(panel.locator('text=LIVE: Test Live Stream')).toBeVisible();
  });

  test('does not show YouTube panel when no live stream', async ({ page, context }) => {
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

    // Verify the club scene loaded
    await expect(page.locator('text=SALIR')).toBeVisible({ timeout: 20000 });

    // No YouTube panel should be present
    const panel = page.getByTestId('youtube-panel');
    await expect(panel).toHaveCount(0);
  });
});
