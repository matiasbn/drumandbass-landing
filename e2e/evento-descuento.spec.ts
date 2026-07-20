import { test, expect, Page } from '@playwright/test';

/**
 * Descuento Junglist en la landing de evento: qué ve cada perfil.
 *
 * Dos grupos:
 *
 * 1. Estados sin sesión — corren siempre. El componente resuelve "anónimo" sin
 *    tocar la red (no hay cookie sb-), así que basta con visitar la página.
 *
 * 2. Estados con sesión — necesitan el modo de sesiones simuladas, porque
 *    falsificar una sesión de Supabase desde el navegador es frágil: getUser()
 *    valida el token contra el servidor de auth y una cookie inventada no pasa.
 *    Usan los perfiles simulados, que solo existen en desarrollo:
 *
 *      E2E_EVENT_ID=<uuid-de-un-evento-con-cupón> npx playwright test evento-descuento
 *
 *    Fuera de dev se saltan solos con un mensaje claro, en vez de fallar.
 *
 * El evento debe existir en la DB de dev y tener cupón configurado: la landing
 * es ISR sobre datos reales.
 */

const EVENT_ID = process.env.E2E_EVENT_ID ?? '';

const GATE = { role: 'dialog' as const, name: 'Descuento Junglist' };

async function gotoEvento(page: Page) {
  test.skip(!EVENT_ID, 'Falta E2E_EVENT_ID: pasa el uuid de un evento de la DB de dev');
  const res = await page.goto(`/evento/${EVENT_ID}`);
  test.skip(!res || res.status() === 404, `El evento ${EVENT_ID} no existe en esta DB`);
}

/** Fija el perfil simulado y comprueba que los perfiles estén disponibles. */
async function usePersona(page: Page, persona: string) {
  await page.context().addCookies([
    { name: 'dnb_mock_persona', value: persona, domain: 'localhost', path: '/' },
  ]);
  await gotoEvento(page);
  const devPanel = await page.getByRole('button', { name: /DEV · perfil simulado/i }).count();
  test.skip(devPanel === 0, 'Los perfiles simulados solo existen en desarrollo');
}

/**
 * Salta el test si al evento no le corresponde cupón para este perfil. Los
 * códigos son datos reales del CMS: un evento configurado "solo para nuevos" no
 * le da nada a un junglist antiguo, y eso es correcto, no un fallo.
 */
async function skipSiNoHayCupon(page: Page, persona: string) {
  const tieneCodigo = await page.getByText(/Tu descuento Junglist/i).count();
  test.skip(
    tieneCodigo === 0,
    `El evento no tiene cupón para "${persona}". Configura uno en la campaña para probar este caso.`
  );
}

test.describe('Descuento Junglist · sin sesión', () => {
  test('anónimo ve la puerta con las dos salidas', async ({ page }) => {
    await gotoEvento(page);

    await expect(page.getByRole(GATE.role, { name: GATE.name })).toBeVisible();
    await expect(page.getByText(/Inscríbete y obtén tu descuento/i)).toBeVisible();
    await expect(page.getByText(/No quiero ser Junglist/i)).toBeVisible();
  });

  test('la salida colapsa la puerta y deja volver', async ({ page }) => {
    await gotoEvento(page);

    await page.getByText(/No quiero ser Junglist/i).click();
    await expect(page.getByRole(GATE.role, { name: GATE.name })).toBeHidden();

    // La franja permite arrepentirse: al volver, la puerta reaparece.
    const franja = page.getByRole('button', { name: /ver cómo obtenerlo/i });
    await expect(franja).toBeVisible();
    await franja.click();
    await expect(page.getByRole(GATE.role, { name: GATE.name })).toBeVisible();
  });

  test('la puerta bloquea el scroll del evento de atrás', async ({ page }) => {
    await gotoEvento(page);

    await expect(page.getByRole(GATE.role, { name: GATE.name })).toBeVisible();
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  });
});

test.describe('Descuento Junglist · con sesión simulada', () => {
  test('junglist antiguo ve su código, sin puerta encima', async ({ page }) => {
    await usePersona(page, 'junglist_old');
    // Sea cual sea la config, a un junglist NUNCA se le bloquea la página.
    await expect(page.getByRole(GATE.role, { name: GATE.name })).toHaveCount(0);

    await skipSiNoHayCupon(page, 'junglist_old');
    await expect(page.getByText(/Por ser Junglist/i)).toBeVisible();
  });

  test('junglist nuevo recibe el saludo de bienvenida', async ({ page }) => {
    await usePersona(page, 'junglist_new');

    await skipSiNoHayCupon(page, 'junglist_new');
    await expect(page.getByText(/Bienvenido a la comunidad/i)).toBeVisible();
  });

  test('un DJ cuenta como junglist', async ({ page }) => {
    await usePersona(page, 'dj');

    await expect(page.getByRole(GATE.role, { name: GATE.name })).toHaveCount(0);
  });

  test('no se contradice: quien ya es junglist no ve "únete"', async ({ page }) => {
    await usePersona(page, 'junglist_old');

    await expect(page.getByRole('link', { name: /Mi perfil Junglist/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Únete como Junglist/i })).toHaveCount(0);
  });
});
