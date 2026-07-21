// Etiquetas/descripciones de eventos compartidas entre el dashboard diario y la
// vista mensual. Client-safe (sin cliente de GA). Al agregar un evento nuevo,
// súmalo aquí (label + tip + SITE_EVENT_ORDER) — ver la convención en CLAUDE.md.

export const fmt = (n: number) => n.toLocaleString('es-CL');

// Nombres legibles para los eventos de GA4.
export const EVENT_LABELS: Record<string, string> = {
  page_view: 'Vistas de página',
  session_start: 'Sesiones iniciadas',
  user_engagement: 'Interacción',
  first_visit: 'Primeras visitas',
  scroll: 'Scroll de página',
  click: 'Clics a enlaces externos',
  form_start: 'Formularios iniciados',
  form_submit: 'Formularios enviados',
  event_link_click: 'Clic a tickets de evento',
  button_click: 'Clics en botones',
  ui_click: 'Clics en la interfaz',
  logout: 'Cierres de sesión',
  login: 'Inicios de sesión',
  junglist_signup: 'Registros de junglist',
  junglist_unsubscribe: 'Bajas de junglist',
  presskit_created: 'Presskits creados',
  presskit_saved: 'Presskits guardados',
  presskit_publish: 'Presskit publicado/despublicado',
  presskit_view: 'Vistas de presskit',
  release_publish: 'Releases publicados (DJ)',
  release_click: 'Clic a un release',
  sotano_video_click: 'Clic a video de El Sótano',
  social_click: 'Clic a redes sociales',
  whatsapp_click: 'Clic a WhatsApp',
  logo_download: 'Descargas de logos (ZIP)',
  enter_club: 'Entradas al club 3D',
  // SUBIDÓN (shooter del club 3D)
  club_shot_fired: 'Disparos en el club (muestreo 1/50)',
  club_hype_drop: 'HYPE DROPs (NPC al 100%)',
  club_club_drop: 'CLUB DROPs (energía al máximo)',
  club_gloria: 'GLORIAs alcanzadas',
  club_vip_caught: 'VIPs capturados',
  club_special_used: 'Especiales usados en el club',
  club_hype_bump: 'Hype-bumps entre jugadores',
  club_session_summary: 'Sesiones de juego cerradas (club)',
  club_quality_change: 'Cambios de calidad gráfica (club)',
  club_sound_toggle: 'Toggle de sonido del club',
  club_shake_toggle: 'Toggle de vibración de cámara (club)',
  club_round_start: 'Rounds iniciados (club)',
  club_round_end: 'Rounds terminados (club)',
  landing_evento_view: 'Vistas de landing de evento',
  junglist_coupon_view: 'Cupones Junglist revelados',
  junglist_coupon_copy: 'Cupones Junglist copiados',
  junglist_coupon_dismiss: 'Descartaron el descuento Junglist',
};
export const eventLabel = (name: string) => EVENT_LABELS[name] ?? name;

export const EVENT_TIPS: Record<string, string> = {
  page_view: 'Se registra cada vez que se carga una página.',
  session_start: 'El comienzo de una visita (sesión).',
  user_engagement: 'La persona estuvo activa/interactuando en la página.',
  first_visit: 'La primera vez que un usuario visita el sitio.',
  scroll: 'La persona hizo scroll hasta cerca del final de la página (~90%).',
  click: 'Clic a un enlace que sale del sitio (saliente).',
  form_start: 'La persona empezó a completar un formulario.',
  form_submit: 'La persona envió un formulario.',
  event_link_click: 'Clic al botón "Tickets" de un evento (evento propio del sitio).',
  button_click: 'Clic en un botón rastreado del home.',
  ui_click: 'Clic en cualquier botón o enlace del sitio (auto-tracking).',
  login: 'Inicio de sesión con Google (presskit).',
  logout: 'Alguien cerró sesión desde el indicador de sesión del header.',
  junglist_signup: 'Un usuario completó su registro como junglist.',
  junglist_unsubscribe: 'Un junglist se dio de baja.',
  presskit_created: 'Un DJ creó su presskit por primera vez.',
  presskit_saved: 'Un DJ guardó cambios en su presskit.',
  presskit_publish: 'Un DJ publicó o despublicó su presskit.',
  presskit_view: 'Alguien vio un presskit público.',
  release_publish: 'Un DJ marcó un release para publicarlo en Releases Nacionales.',
  release_click: 'Un visitante hizo clic en un release (hacia SoundCloud).',
  sotano_video_click: 'Clic a un video de El Sótano (hacia YouTube).',
  social_click: 'Clic a una red social (Instagram, SoundCloud, YouTube, Spotify, etc.).',
  whatsapp_click: 'Clic a un enlace de WhatsApp (grupo o contacto).',
  logo_download: 'Descarga del ZIP de logos de un DJ.',
  enter_club: 'Alguien entró al club 3D.',
  // SUBIDÓN (shooter del club 3D)
  club_shot_fired: 'Disparos del Bass Cannon. Muestreado 1 de cada 50 para no saturar GA.',
  club_hype_drop: 'Un NPC llegó a 100 de hype y celebró un HYPE DROP.',
  club_club_drop: 'La Energía del Club llegó al máximo: CLUB DROP (+100 pts y GLORIA).',
  club_gloria: 'Empezó una GLORIA (25s de fiesta total tras un CLUB DROP).',
  club_vip_caught: 'Un jugador capturó al NPC VIP dorado (3 hits en 10s).',
  club_special_used: 'Un jugador usó un movimiento especial (param special).',
  club_hype_bump: 'Dos jugadores se energizaron entre sí (disparo jugador a jugador).',
  club_session_summary: 'Un jugador cerró su sesión de juego (params: duration_min, club_drops, best_combo, score).',
  club_quality_change: 'Un jugador cambió la calidad gráfica del club (param quality).',
  club_sound_toggle: 'Un jugador activó/desactivó el sonido sintetizado del club (param enabled).',
  club_shake_toggle: 'Un jugador activó/desactivó la vibración de cámara (param enabled).',
  club_round_start: 'Empezó un round de 3 min (durante el stream en vivo).',
  club_round_end: 'Terminó un round (params: winner, my_score, placement, players).',
  landing_evento_view: 'Alguien abrió la landing de un evento (/evento/[id]).',
  junglist_coupon_view: 'Un junglist con sesión iniciada vio su código de descuento en la landing de un evento.',
  junglist_coupon_copy: 'Alguien copió su código de descuento Junglist al portapapeles.',
  junglist_coupon_dismiss: 'Alguien eligió seguir al evento sin inscribirse como Junglist. Mide cuánta gente prefiere no registrarse.',
};
export const eventTip = (name: string) => EVENT_TIPS[name] ?? 'Evento registrado en Google Analytics.';

// Acciones que se muestran en el dashboard (siempre, con 0 si aún no hay datos).
// Orden fijo de importancia (NO se ordena por valor en la vista).
export const CORE_ACTIONS = [
  'junglist_signup', // 1. registro de junglist
  'event_link_click', // 2. clic a tickets de evento
  'sotano_video_click', // 3. clic a video de El Sótano
  'whatsapp_click', // 4. clic a WhatsApp
  'release_click', // 5. clic a un release
  'enter_club', // 6. entradas al club
  'social_click', // 7. clic a redes sociales
  'junglist_unsubscribe', // 8. bajas de junglist
  'club_club_drop', // 9. CLUB DROPs del shooter (¿el ciclo está bien tuneado?)
  'club_session_summary', // 10. sesiones de juego cerradas (duración/score en params)
  'club_round_end', // 11. rounds de 3 min terminados (ganadores/participación)
];

// Acciones que se trackean pero NO se muestran en el dashboard (back-office de
// DJs: crear/guardar/publicar presskit, marcar release, descargar logos). Se
// siguen registrando en GA por si algún día se quieren mirar allá.
export const HIDDEN_ACTIONS = [
  'login',
  'logout',
  'release_publish',
  'presskit_view',
  'presskit_created',
  'presskit_saved',
  'presskit_publish',
  'logo_download',
  // SUBIDÓN: señales de alto volumen o de tuning fino — se acumulan en GA
  // por si hay que mirarlas (mover a CORE_ACTIONS para mostrarlas).
  'club_shot_fired',
  'club_hype_drop',
  'club_gloria',
  'club_vip_caught',
  'club_special_used',
  'club_hype_bump',
  'club_quality_change',
  'club_sound_toggle',
  'club_shake_toggle',
  'club_round_start',
  'landing_evento_view',
  'junglist_coupon_view',
  'junglist_coupon_copy',
  'junglist_coupon_dismiss',
];
