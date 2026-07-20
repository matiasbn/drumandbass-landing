/**
 * Simulación de producción en local.
 *
 * Con `NEXT_PUBLIC_PROD_SIM=1` se apagan de golpe TODAS las ayudas de desarrollo
 * (perfiles simulados, eventos sintéticos, panel de identidad), para ver la app
 * como la ve alguien de verdad sin tener que acordarse de desactivar cada una.
 *
 *   NEXT_PUBLIC_PROD_SIM=1 npm run dev
 *
 * Es NEXT_PUBLIC_ porque tanto el servidor como el cliente tienen que leerlo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ **NO** HACE, a propósito
 *
 * Apaga los atajos de desarrollo; NO convierte el entorno en producción. Hay
 * efectos que sí serían reales y no se pueden deshacer como una fila de la DB:
 *
 * - **Analytics**: sigue sin cargar GA. Si lo activara, el tráfico de pruebas
 *   entraría a la propiedad real de GA4 y ahí no se puede borrar — envenenaría
 *   las métricas del sitio para siempre.
 * - **URLs de los correos**: siguen apuntando a localhost. Si apuntaran al
 *   dominio real, un envío de prueba mandaría gente al sitio en producción y el
 *   tracking del click se registraría como si fuera tráfico real.
 *
 * O sea: reversible en la DB, sí; irreversible en servicios externos, no.
 */
export const PROD_SIM = process.env.NEXT_PUBLIC_PROD_SIM === '1';

/** Las ayudas de desarrollo están disponibles. */
export const DEV_TOOLS_ENABLED = process.env.NODE_ENV === 'development' && !PROD_SIM;
