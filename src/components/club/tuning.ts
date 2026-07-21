// SUBIDÓN — fuente única de constantes de gameplay (ver DESIGN_CLUB_SHOOTER.md, apéndice TUNING).
// Nada de estas cifras debe hardcodearse en componentes: importar siempre desde aquí.

export const TUNING = {
  /** Bass Cannon (M1) — disparo principal */
  arma: {
    shotCooldownMs: 400, // cooldown entre disparos
    shotSpeed: 22, // u/s
    shotLifeS: 1.2, // vida del proyectil
    shotRadius: 0.12, // radio visual/colisión del proyectil
    npcHitRadius: 0.9, // radio de impacto contra NPCs
    playerHitRadius: 1.0, // radio de impacto contra jugadores
  },

  /** Beat clock (M2) — 174 BPM, ventana de beat-shot */
  beat: {
    bpm: 174,
    windowMs: 80, // ±80ms alrededor del beat
    beatHypeMult: 1.5, // hype x1.5 en beat-shot
  },

  /** Hype de NPC (M3) */
  npc: {
    hypeHit: 22, // ~5 impactos para un HYPE DROP
    hypeBeat: 30, // hit con beat-shot
    hypeGrenade: 14,
    hypeGrenadeFull: 24, // granada a carga completa
    // El club está VIVO por defecto: los NPCs nacen bien arriba y bajan lento,
    // así que casi siempre bailan, se mueven y disparan (llamativos). Dispararles
    // los lleva al HYPE DROP como bonus, NO es una tarea de reanimación.
    decayPerS: 0.6,
    // PISO de hype: nunca bajan de aquí. Sin esto, tras ~80s todos caían bajo el
    // umbral y quedaban con la pose de "mirando el celular" (cabeza inclinada,
    // todos iguales y grises). Con piso, la pista se mantiene viva siempre.
    hypeFloor: 45,
    apagadoUmbral: 15, // inalcanzable con el piso: la pose apagada ya no aparece
    dropResetTo: 60, // hype tras un HYPE DROP (nunca Sísifo)
    dropInmuneS: 5, // inmunidad post-drop (rotación de objetivos)
    spawnHypeMin: 65,
    spawnHypeMax: 100,
  },

  /** Energía del Club (M4/M5/M13) */
  energia: {
    start: 40,
    // La barra tiene que SUBIR jugando: antes decaía 1.0/s y cada HYPE DROP sólo
    // sumaba 10, así que hacía falta un drop cada 10s sólo para empatar y nunca
    // avanzaba. Ahora decae lento y cada logro suma bastante más.
    decayPerS: 0.3,
    decayEscalada: 1.08, // +8% de decay por ciclo post-drop
    decayCap: 1.2,
    porHypeDrop: 18,
    porVip: 25,
    porEspecial: 15,
    etapaMedia: 60, // ≥60 club a full; 30–60 luces al 70%
    etapaBajon: 30, // <30 = EL BAJÓN
    clubDropUmbral: 100,
    umbralPorJugadorExtra: 0.3, // +30% de umbral por jugador extra presente
    gloriaS: 25, // duración de la GLORIA
    postGloriaEnergia: 55,
    chillTrasSinDisparoS: 120, // modo chill tras 120s sin disparar
    chillTecho: 50, // la energía se asienta en min(actual, 50)
  },

  /** Ventanas de drop / DROP INMINENTE (M6) */
  ventanas: {
    dropEventCadaS: [90, 120] as const, // cadencia aleatoria sin live
    dropEventDuraS: 20,
    dropEventMult: 2, // hype x2 durante la ventana
    liveCadaS: 300, // con DJ en vivo: cada 5 min
    liveMult: 3, // hype x3 en DROP INMINENTE
  },

  /** NPC VIP (M7) */
  vip: {
    cadaS: [45, 60] as const,
    duraS: 10,
    hitsNecesarios: 3,
    speedMult: 2.5,
  },

  /** Granada / Bomba de Bajo (M9) */
  granada: {
    cargaMinS: 0.4,
    cargaMaxS: 1.2,
    velMin: 8, // u/s a carga mínima
    velMax: 16, // u/s a carga completa
    blastRadio: 3, // radio ESFÉRICO 3D
    cooldownS: 3,
    multiHypeDesde: 3, // ≥3 NPCs → MULTI-HYPE xN
    gravedad: 9.8, // la misma que ya usa Projectiles.tsx
  },

  /** Combo (M10) — solo acciones de puntería */
  combo: {
    ventanaS: 4, // ventana de decay visible
    // hits encadenados → multiplicador (x2 a 3, x3 a 6, x4 a 10, x5 a 15)
    escalones: [
      { hits: 3, mult: 2 },
      { hits: 6, mult: 3 },
      { hits: 10, mult: 4 },
      { hits: 15, mult: 5 },
    ] as const,
  },

  /** Buff de baile (M11) */
  baile: {
    buffRadio: 3, // ≤3u del NPC
    buffTrasS: 3, // bailar ≥3s
    buffDecayMult: 0.5, // decay del NPC a la mitad
    buffDuraS: 10,
  },

  /** Airshot (M8) */
  airshot: {
    distanciaMin: 8, // o hit a >8u del objetivo
    cooldownS: 2,
    puntos: 10, // bonus flat sobre el hit
  },

  /** Economía de puntos (§6) — la lee ScoreContext */
  puntos: {
    shoot: 0, // 0 por disparar al aire
    jump: 0, // la movilidad no puntúa; su premio es el airshot
    hitNpc: 2, // ×combo
    beatShot: 4, // ×combo, sustituye a hitNpc en ese hit
    airshot: 10, // flat, cooldown 2s
    hypeDropNpc: 15, // ×combo
    grenadeNpc: 8, // flat, por NPC alcanzado
    multiHypeExtra: 8, // flat, por NPC extra desde el 3ro
    vip: 40, // flat
    clubDrop: 100, // flat
    hypeBump: 8, // flat, ambos jugadores, cooldown 5s/pareja
    danceComplete: 5, // participación social, sin combo
    chat: 3, // sin combo, cooldown 10s
    vibingPorMinuto: 10, // SOLO si registraste ≥1 hit ese minuto
    cargaEspecialCada: 250, // antes 100 — la nueva economía rinde más pts/min
    umbralesDesbloqueo: [100, 200, 300, 400, 500] as const,
  },

  /** Física delta-time (M14) — unidades por segundo */
  fisica: {
    moveSpeed: 8.4, // u/s (antes 0.14/frame)
    jumpVel: 9, // u/s (antes 0.15/frame)
    doubleJumpVel: 7, // u/s — derivado: conserva el ratio 0.22/0.28 del doble salto actual
    gravity: 21.6, // u/s² (antes 0.006/frame²)
    dtClampMs: 50, // clamp del delta por frame
  },

  /** Juice (§4) — trauma-shake, hit-stop, squash, kick */
  juice: {
    traumaHit: 0.15,
    traumaExplosion: 0.2,
    traumaHypeDrop: 0.3,
    traumaClubDrop: 0.5,
    traumaDecayPerS: 1.8,
    hitStopMs: 40,
    squashMs: 120,
    muzzleMs: 60,
    kickPitchDeg: 0.6,
    kickRecoverMs: 120,
  },

  /** Capa multiplayer (§5) */
  multi: {
    broadcastMaxPerS: 8, // bajo el límite ~10/s de Supabase Realtime
    hypeBumpCooldownS: 5, // por pareja de jugadores
  },
} as const;

export type Tuning = typeof TUNING;
