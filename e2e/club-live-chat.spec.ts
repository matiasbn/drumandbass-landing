import { test, expect, Page, BrowserContext } from '@playwright/test';

const PROJECT_REF = 'osbvoexqqrptbthvqvkx';

const fakeSession = {
  access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlLXVzZXItaWQiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImV4cCI6OTk5OTk5OTk5OX0.fake',
  refresh_token: 'fake-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  provider_token: 'fake-google-provider-token',
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

async function setupLiveClub(page: Page, context: BrowserContext) {
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
      body: JSON.stringify({
        isLive: true,
        youtubeVideoId: 'dQw4w9WgXcQ',
        title: 'Test Live Stream',
      }),
    })
  );

  // Mock the chat messages endpoint to return a liveChatId
  await page.route('/api/chat/messages*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [],
        liveChatId: 'fake-live-chat-id',
        pollingIntervalMillis: 6000,
      }),
    })
  );

  // Block YouTube iframe from loading (avoid external dependency)
  await page.route('https://www.youtube.com/live_chat**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body style="background:#000;color:#fff">Mock YouTube Chat</body></html>',
    })
  );
}

test.describe('Live Chat - Mobile', () => {
  test.use({
    viewport: { width: 375, height: 667 },
    hasTouch: true,
    isMobile: true,
  });

  test('chat input is tappable and accepts text on mobile', async ({ page, context }) => {
    await setupLiveClub(page, context);
    await page.goto('/club');

    // Wait for club to load — LIVE CHAT button is visible when live
    const chatToggle = page.locator('button', { hasText: 'LIVE CHAT' });
    await expect(chatToggle).toBeVisible({ timeout: 20000 });

    // Open the chat panel
    await chatToggle.tap();

    // The input should be visible
    const chatInput = page.locator('input[placeholder="Escribe un mensaje..."]');
    await expect(chatInput).toBeVisible();

    // Tap the input and type a message
    await chatInput.tap();
    await chatInput.fill('Hola desde mobile');
    await expect(chatInput).toHaveValue('Hola desde mobile');
  });

  test('chat input is not obscured by iframe on mobile', async ({ page, context }) => {
    await setupLiveClub(page, context);
    await page.goto('/club');

    const chatToggle = page.locator('button', { hasText: 'LIVE CHAT' });
    await expect(chatToggle).toBeVisible({ timeout: 20000 });
    await chatToggle.tap();

    const chatInput = page.locator('input[placeholder="Escribe un mensaje..."]');
    await expect(chatInput).toBeVisible();

    // Verify the input receives focus when tapped (not intercepted by iframe)
    await chatInput.tap();
    const isFocused = await chatInput.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(true);
  });

  test('send button triggers API call on mobile', async ({ page, context }) => {
    await setupLiveClub(page, context);

    // Mock the send endpoint
    let sendCalled = false;
    let sentBody: { liveChatId: string; message: string } | null = null;
    await page.route('/api/chat/send', (route) => {
      sendCalled = true;
      sentBody = JSON.parse(route.request().postData() || '{}');
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/club');

    const chatToggle = page.locator('button', { hasText: 'LIVE CHAT' });
    await expect(chatToggle).toBeVisible({ timeout: 20000 });
    await chatToggle.tap();

    // Type message and send
    const chatInput = page.locator('input[placeholder="Escribe un mensaje..."]');
    await chatInput.tap();
    await chatInput.fill('Test message');

    const sendButton = page.locator('button[type="submit"]');
    await sendButton.tap();

    // Wait for the API call
    await page.waitForTimeout(500);

    expect(sendCalled).toBe(true);
    expect(sentBody?.message).toBe('Test message');
    expect(sentBody?.liveChatId).toBe('fake-live-chat-id');

    // Should show success message
    await expect(page.locator('text=Mensaje enviado')).toBeVisible();
  });
});

test.describe('Live Chat - Desktop', () => {
  test('chat input works and sends message on desktop', async ({ page, context }) => {
    await setupLiveClub(page, context);

    let sendCalled = false;
    await page.route('/api/chat/send', (route) => {
      sendCalled = true;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/club');

    const chatToggle = page.locator('button', { hasText: 'LIVE CHAT' });
    await expect(chatToggle).toBeVisible({ timeout: 20000 });
    await chatToggle.click();

    const chatInput = page.locator('input[placeholder="Escribe un mensaje..."]');
    await expect(chatInput).toBeVisible();

    // Type and send
    await chatInput.click();
    await chatInput.fill('Desktop message');
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(500);
    expect(sendCalled).toBe(true);
    await expect(page.locator('text=Mensaje enviado')).toBeVisible();
  });

  test('shows sending state while message is in flight', async ({ page, context }) => {
    await setupLiveClub(page, context);

    // Delay the send response to observe loading state
    await page.route('/api/chat/send', async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/club');

    const chatToggle = page.locator('button', { hasText: 'LIVE CHAT' });
    await expect(chatToggle).toBeVisible({ timeout: 20000 });
    await chatToggle.click();

    const chatInput = page.locator('input[placeholder="Escribe un mensaje..."]');
    await chatInput.fill('Slow message');
    await page.locator('button[type="submit"]').click();

    // Should show sending state
    await expect(page.locator('text=Enviando mensaje...')).toBeVisible();

    // Input should be disabled while sending
    await expect(chatInput).toBeDisabled();

    // After response, should show success
    await expect(page.locator('text=Mensaje enviado')).toBeVisible({ timeout: 5000 });
  });
});
