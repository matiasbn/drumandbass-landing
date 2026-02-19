import { test, expect, Page, BrowserContext, devices } from '@playwright/test';

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

  await page.route('/api/live', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ isLive: false, youtubeVideoId: null, title: null }),
    })
  );
}

// Use mobile viewport with touch enabled
test.use({
  viewport: { width: 375, height: 667 },
  hasTouch: true,
  isMobile: true,
});

test.describe('Club Mobile Controls - No Scroll', () => {
  test('club container has overflow-hidden and touch-none to prevent scroll', async ({ page, context }) => {
    await setupClubAuth(page, context);
    await page.goto('/club');
    await expect(page.locator('text=SALIR')).toBeVisible({ timeout: 20000 });

    // The main club container should have overflow-hidden and touch-none
    const clubContainer = page.locator('div.overflow-hidden.touch-none').first();
    await expect(clubContainer).toBeVisible();

    // Verify computed style: touch-action should be none on the container
    const touchAction = await clubContainer.evaluate((el) =>
      getComputedStyle(el).touchAction
    );
    expect(touchAction).toBe('none');
  });

  test('page does not scroll when swiping on the screen', async ({ page, context }) => {
    await setupClubAuth(page, context);
    await page.goto('/club');
    await expect(page.locator('text=SALIR')).toBeVisible({ timeout: 20000 });

    // Get initial scroll position
    const scrollBefore = await page.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY,
    }));

    // Simulate touch swipe down in the center of the screen
    await page.touchscreen.tap(187, 400);
    await page.waitForTimeout(100);

    // Simulate a drag gesture (swipe down)
    await page.evaluate(async () => {
      const start = new Touch({
        identifier: 1,
        target: document.body,
        clientX: 187,
        clientY: 300,
      });
      const end = new Touch({
        identifier: 1,
        target: document.body,
        clientX: 187,
        clientY: 500,
      });

      document.body.dispatchEvent(new TouchEvent('touchstart', {
        touches: [start],
        changedTouches: [start],
        bubbles: true,
      }));

      document.body.dispatchEvent(new TouchEvent('touchmove', {
        touches: [end],
        changedTouches: [end],
        bubbles: true,
      }));

      document.body.dispatchEvent(new TouchEvent('touchend', {
        touches: [],
        changedTouches: [end],
        bubbles: true,
      }));
    });

    await page.waitForTimeout(300);

    const scrollAfter = await page.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY,
    }));

    expect(scrollAfter.x).toBe(scrollBefore.x);
    expect(scrollAfter.y).toBe(scrollBefore.y);
  });

  test('mobile controls are visible on touch device', async ({ page, context }) => {
    await setupClubAuth(page, context);
    await page.goto('/club');
    await expect(page.locator('text=SALIR')).toBeVisible({ timeout: 20000 });

    // Joystick should be visible (the rounded-full bg-white/10 div)
    const joystick = page.locator('div.rounded-full.backdrop-blur').first();
    await expect(joystick).toBeVisible();
  });
});
