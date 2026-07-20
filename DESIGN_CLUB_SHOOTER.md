# SUBIDÓN — Diseño Final del Shooter del Club
**Documento único y definitivo. Base: "SUBIDÓN — Bass Cannon en el Club" (ganadora 3/3 veredictos), con los injertos consensuados por los jueces: GLORIA, DROP INMINENTE vía LiveContext, títulos cosméticos, buff de baile, HUD de distancia al leaderboard, objeto TUNING verificado, re-rol táctico de especiales, MULTI-HYPE xN, tick pentatónico de combo, pose "mirando el celular" y resumen de sesión.**

Verificado contra el código real del repo (rutas bajo `src/components/club/`): `ProjectileContext.tsx` (refs, `shoot()` a 15 u/s, `checkHits` por punto instantáneo, blast 2D), `Projectiles.tsx` (pools: 30 shots / 10 granadas / 10 explosiones de 40 partículas), `HealthContext.tsx` (`npcHypeRef`, HYPE_SHOT 15 / GRENADE 25, decay 3/s solo del jugador, reset NPC a 0), `InstancedDancers.tsx` (16 NPCs en typed arrays, ids `npc-${nombre}`, instanceColor ya montado, barras de hype instanciadas), `ThirdPersonCamera.tsx` (yaw/pitch en `CameraContext`, pointer lock en click al canvas), `PlayerDancer.tsx` (mousedown global L380-436: cualquier click dispara, cooldown 500ms, `scoreAction('shoot')`), `ScoreContext.tsx` (POINTS/COOLDOWNS, combo por cualquier acción, `playerPosition` en useState = re-render 60Hz, +10/min AFK), `MultiplayerContext.tsx` (canal `'nightclub'` solo presence, sin broadcast), `LiveContext.tsx` (`isLive` poll 60s), `constants.ts` (`MAP.moveSpeed 0.14`/frame = física sin delta-time), `SpecialEffects.tsx` (`earthquakeActiveUntil`/`levitateActiveUntil` exportados), `SettingsModal.tsx` (solo toggle antialias), `src/lib/analyticsLabels.ts` (CORE_ACTIONS L68, HIDDEN_ACTIONS L82) y `src/lib/ga.ts` (SITE_EVENT_NAMES L78).

---

## 1. Nombre y pitch

**SUBIDÓN** *(internamente: Bass Cannon)*

Eres el/la hype-person armado del club: tu **Bass Cannon** dispara energía que hace bailar a la gente. La fiesta se apaga sola —los bailarines se aburren y miran el celular, las luces se atenúan— y tú la mantienes viva disparando **al ritmo del drum and bass**. Cada disparo suena y se siente como un golpe de batería; disparar en el beat (174 BPM, marcado por los strobes) lo convierte en un instrumento. Llenar la Energía del Club dispara el **CLUB DROP**, y tras el drop llega la **GLORIA**: 25 segundos de fiesta total sin exigencias — el momento que el juego te regala para mirar el stream del DJ. Nada muere, nada te ataca: lo único que puede morir es la fiesta, y tú no lo vas a permitir.

**Invariante de diseño (regla para toda decisión de tuning): fallar cuesta bonus, nunca progreso. Soltar el mouse para ver el stream siempre es una opción sin ansiedad.**

---

## 2. Core loop y arco de sesión

### Core loop de ~15 segundos
1. **Escaneo (2-3s):** lees la pista de un vistazo — NPCs APAGADOS (grises, encorvados, mirando el celular), la barra de Energía del Club, quizá un VIP dorado corriendo.
2. **Apuntar y disparar (4-6s):** crosshair con pitch real. 3-4 disparos a 400ms de cooldown; intentas cazar el pulso de los strobes → **BEAT-SHOT** (tracer dorado, kick de batería, hype x1.5). Cada hit: hitmarker + tick (que sube de tono con el combo) + squash del NPC + hit-stop 40ms.
3. **Payoff (2-3s):** el NPC llega a 100 → **HYPE DROP**: baile de celebración 3s, shockwave, +15×combo, +10 a la Energía del Club.
4. **Decisión (2-3s):** ¿granada cargada al grupo apagado (MULTI-HYPE xN)? ¿perseguir el VIP? ¿airshot desde la plataforma? ¿o girar la cabeza al stream 5 segundos porque la energía está sana? El combo tiene barra de decay de 4s visible que te invita (no obliga) a encadenar.

### Arco de sesión de 15 minutos (números concretos, solo-player)
Matemática base verificada (§6 y apéndice TUNING): jugador casual competente ≈ 1.2 hits/s efectivos → +18 hype/s a un NPC (decay −4/s) → HYPE DROP cada ~6s → +10 energía/6s = +1.67/s contra decay −1.0/s → **neto +0.67/s**.

| Minuto | Qué pasa | Números |
|---|---|---|
| 0:00–0:30 | Spawn. Energía en 40, 3 NPCs apagados. Hint en HUD: "Dispara energía a los que se apagan". | Primer hit en <10s; primer HYPE DROP en <30s |
| 0:30–2:00 | Warm-up: cadena de hype drops, aprendes el beat mirando los strobes. | ~10-14 hype drops; **primer CLUB DROP ≈ 1:30-2:00** (60 de energía / +0.67 por s de juego activo) |
| 2:00–2:25 | **GLORIA**: 25s sin decay, todo el club baila. Miras el stream. | +100 pts del drop; energía queda en 55 al salir |
| 2:30 | Primera carga de especial (~250 pts). Primer VIP dorado ya apareció (cadencia 45-60s). | VIP: 3 hits en 10s → +40 |
| 3:00–5:00 | Primera **VENTANA DE DROP** (2:00-3:30 desde inicio, luego cada 90-120s): 20s de hype x2. Segundo CLUB DROP ≈ 4:30. | Decay sube a −1.1/s tras el 1er drop |
| 5:00–10:00 | El club exige más: apagados simultáneos 3→6, decay −1.2→−1.5/s, ventanas cada 90s. HUD muestra "te faltan N pts para superar a \<siguiente\>". | 3er-4to CLUB DROP; ritmo sinusoidal tensión→GLORIA |
| 10:00–15:00 | Peak: decay cap −2.0/s, hasta 8 apagados, VIP cada 45s. Perseguir tu récord de drops/combo. | 5to-6to CLUB DROP posibles; récords `best_combo`/`best_club_drops` |
| Si el DJ está **LIVE** | Cada 5:00 → **DROP INMINENTE** 🔴: 20s de hype x3, VIP garantizado, banner con el título del live. Sincroniza a todos los presentes con el stream real. | Reemplaza a la ventana normal de ese ciclo |
| Salida | **Resumen de sesión** (al usar "Salir" del menú): drops, mejor combo, VIPs, posición ganada en leaderboard + título cosmético si subió. | GA `club_session_summary` |
| Pasividad | 120s sin disparar → **modo chill**: decay 0, energía se asienta en min(actual, 50), icono zen en HUD. Sale al primer disparo. | El espectador puro nunca es castigado |

---

## 3. Lista COMPLETA de mecánicas con parámetros

Todas las constantes viven en **un único módulo nuevo `src/components/club/tuning.ts`** que exporta `TUNING` (apéndice al final). Nada hardcodeado en componentes.

**M1 — Bass Cannon (disparo, rework).** Cooldown **400ms**; proyectil **22 u/s**, vida **1.2s**; dirección = **raycast desde la cámara por el crosshair con pitch real** (derivada de `cameraYawRef`/`cameraPitchRef` de `CameraContext`, no del yaw del jugador). Colisión **por segmento** (posición en t−dt → t) contra: NPCs (radio 0.9), otros jugadores (radio 1.0) y **lista estática de AABBs** (paredes del MAP, plataformas, booth — nuevo `colliders.ts` derivado de `MAP` y las cajas de `Platforms.tsx`). La bala muere en la pared con chispa. **Gate de input:** solo dispara si `pointerLockedRef.current === true`; el click que adquiere el lock y cualquier click sobre UI se ignoran (hoy `PlayerDancer.tsx` escucha `mousedown` en `window` sin filtro — ese es el bug).

**M2 — Beat clock 174 BPM.** Nuevo módulo `beatClock.ts`: fuente única `performance.now()`, período 344.8ms, expone `getBeatPhase()` y `isOnBeat(±80ms)`. Strobes y láseres se suscriben al MISMO clock (el jugador sincroniza con lo que VE, no con el audio del iframe — CORS impide analizar el stream; es el groove del club, no el de la canción). **BEAT-SHOT:** disparo dentro de ±80ms → hype x1.5 (15→22), puntos x2 (2→4), tracer/muzzle dorados, kick de batería.

**M3 — Hype de NPC (16 instanciados, `HealthContext` + `InstancedDancers`).** Hype 0–100 por NPC, spawn inicial 30–60, **decay −4/s** (pausado mientras celebra). Hit **+15**, beat-shot **+22**, granada **+12** (carga completa **+20**). **APAGADO** (<30): deja de bailar, pose encorvada **mirando el celular** (brazos al frente, cabeza baja — comunica aburrimiento, no hostilidad), color desaturado vía `instanceColor` (ya montado). A 100 → **HYPE DROP**: baile de celebración 3s (reutiliza el ciclo hyped existente), **+15 pts×combo**, +10 Energía; resetea a **40** (no a 0 — nunca Sísifo) e **inmune 5s** (fuerza rotación de objetivos). Solo los proyectiles del JUGADOR alteran hype; los disparos NPC↔NPC siguen siendo cosméticos.

**M4 — Energía del Club (nuevo `EnergyContext`, todo en refs).** Barra global 0–100, arranca en 40, **decay base −1.0/s**. Fuentes: HYPE DROP +10, VIP +15, especial usado +10, hype drops de otros jugadores +10. Etapas visibles (leídas por Lighting/StrobeWalls/LaserFloor): **≥60** club a full; **30–60** luces al 70%, láseres lentos; **<30 = EL BAJÓN**: luces al 40%, strobes apagados, NPCs lentos y encorvados — la amenaza es ambiental, legible por el rabillo del ojo, jamás un game over. A **100 → CLUB DROP** (celebración 5s: flash, acorde, +100 pts, los 16 NPCs en baile sincronizado) → **GLORIA**.

**M5 — GLORIA (injerto, 3/3 jueces).** Tras cada CLUB DROP: **25s** con decay 0, todos los NPCs a 100 bailando, borde dorado del HUD con texto "GLORIA — disfruta el set". Es el permiso explícito de mirar el stream. Al terminar: energía 55, NPCs a 60±10, decay del ciclo siguiente +10% (cap −2.0/s).

**M6 — VENTANA DE DROP / DROP INMINENTE (injerto LiveContext, 3/3).** Sin live: cada 90–120s (acortando a 75s post-min 8), banner 20s "¡VENTANA DE DROP! x2": hype x2 y VIP garantizado. Con `isLive === true`: cadencia fija cada 5 min, **"DROP INMINENTE 🔴"** con el `liveTitle`, hype **x3** — el stream real es el metrónomo de los picos.

**M7 — NPC VIP.** Cada 45–60s un NPC se tiñe dorado (emissive en su instancia) y camina rápido (×2.5) durante **10s**; **3 hits** antes de que expire → **+40 pts**, +15 energía, confetti. Premia puntería sobre blanco móvil.

**M8 — AIRSHOT.** Hit estando el jugador en el aire (leído de `playerStateRef.airborne`) o a >8u del objetivo → **+10 pts extra** (flat, cooldown 2s) y hitmarker estrella. Hace útiles plataformas y doble salto.

**M9 — Granada / Bomba de Bajo (rework).** Mantener click derecho: carga 0.4–1.2s con **anillo creciente en el crosshair + tono ascendente + arco de trayectoria punteado** (12 puntos precomputados con la gravedad 9.8 ya usada). Velocidad 8→16 u/s según carga. Explosión **ESFÉRICA 3D radio 3u** (hoy el check es dx/dz — incluye ahora NPCs en plataformas): +12 hype (+20 a carga completa) a todo NPC en radio, +8 pts por NPC alcanzado. **≥3 NPCs → popup "MULTI-HYPE xN"** +8 por NPC extra (injerto). Cooldown 3s. Feedback: flash + shockwave ring expansivo + partículas del pool.

**M10 — Combo (rework).** SOLO lo alimentan acciones de puntería: hit, beat-shot, airshot, hype drop, VIP, multi-hype, hype-bump. Ventana **4s** con barra de decay visible junto al crosshair. Escalones: **x2 a 3, x3 a 6, x4 a 10, x5 a 15** hits encadenados. **Fallar un disparo NO rompe el combo** (decisión de los jueces: castigar el miss es anti-second-screen); solo expira por tiempo, con fade suave "combo perdido" sin castigo de puntos. El multiplicador colorea tracer y borde del crosshair (rosa→cian→dorado) y **el tick de hit sube en escala pentatónica con el combo** (injerto: el combo se OYE).

**M11 — Buff de baile (injerto).** Bailar (teclas 1-5) durante ≥3s a ≤3u de un NPC → su decay se reduce a la mitad por 10s, con aura sutil compartida. Participar sin disparar sigue siendo participar; mantiene relevantes los bailes y da rol al jugador chill.

**M12 — Especiales re-rolados (injerto; reutiliza desbloqueos y `SpecialEffects.tsx`).** Los 5 existentes pasan a herramientas tácticas: **Onda** = +15 hype a todos los NPCs en 8u; **Spotlight** = el foco te sigue 10s y tus hits dan +50% hype; **Confetti** = todos los APAGADOS suben a 60 al instante (el salvavidas anti-Bajón); **Levitar** = igual que hoy (sinergia con airshots); **Terremoto** = +25 Energía del Club directa (el clutch pre-drop). Desbloqueos en 100/200/300/400/500 pts de sesión (sin cambio); **cargas cada 250 pts** (antes 100 — la nueva economía rinde más puntos/min, ver §6).

**M13 — Modo chill.** 120s sin disparar → decay 0, energía se asienta en min(actual, 50), sin banners. Sale al primer disparo. Diseñado para el usuario que entró solo a ver el stream — el que el negocio quiere retener.

**M14 — Física delta-time (fundación).** `MAP.moveSpeed 0.14/frame → 8.4 u/s`, `jumpVelocity 0.15 → 9 u/s`, `gravity 0.006 → 21.6 u/s²`; dt con clamp 50ms en el loop de `PlayerDancer` y en proyectiles. A 120Hz el juego ya no corre 2x.

**M15 — Récords y títulos (injerto).** 2 columnas nuevas en `profiles`: `best_combo int default 0`, `best_club_drops int default 0` (migración en `supabase/migrations/` + espejo en `supabase-schema.sql`; se aplica a mano en el SQL Editor, como manda CLAUDE.md). Al entrar, el HUD muestra "Récord: N drops — supéralo". Títulos cosméticos como chip junto al username en `Chat.tsx` según `best_club_drops` histórico: ≥1 **Warm-up**, ≥3 **Selector**, ≥5 **Hype Master**. HUD de leaderboard en vivo: "te faltan N pts para superar a \<siguiente\>" (los datos ya están en `leaderboard` de ScoreContext).

---

## 4. Tabla de feedback/juice por evento

Sonido 100% WebAudio sintetizado (nuevo `sounds.ts`: osciladores + noise, cero assets, AudioContext inicializado en el primer gesto, master gain bajo ~0.5 para no pelear con el stream, toggle de mute propio en Settings). Shake por sistema de **trauma** (shake = trauma², desplazamiento máx 0.12u + roll 1°, decay 1.8/s, cap 1.0, toggle en Settings). Hit-stop **por índice de NPC** (congela solo el reloj de animación de esa instancia — sin refactor global de `InstancedDancers`).

| Evento | Tier | Visual | Audio | Cámara / HUD | Trauma |
|---|---|---|---|---|---|
| Disparo | 0 | Muzzle flash (quad aditivo pooled, 60ms, 0.4→0), tracer estirado por velocidad | "Pew" (osc triangular + noise, pitch ±10%) | Kick: pitch +0.6°, retroceso 0.06u, recover 120ms ease-out | — |
| Cooldown listo | 0 | Crosshair se re-expande | Tick sutil de UI | — | — |
| Bala muere en pared | 0 | Chispa 4 partículas pooled | Tap seco | — | — |
| Click en cooldown | 0 | — | Click seco (nunca silencio) | — | — |
| Hit a NPC | 1 | Flash blanco emissive 80ms + squash 1.25x/0.75y 120ms spring | Tick **pentatónico que sube con el combo** + thump grave | Hitmarker X 80ms, popup "+2" | +0.15 |
| BEAT-SHOT | 1+ | Todo lo anterior dorado; los strobes dan un pulso extra ese frame (el mundo confirma tu timing) | Kick drum encima del pew | Popup "¡RITMO! x2" | +0.15 |
| AIRSHOT | 1+ | Hitmarker estrella | Ding agudo | Popup "+10 AIRSHOT" | +0.15 |
| Hype-bump entre jugadores | 1 | Flash dorado + micro-baile 0.5s del receptor | Chime doble | "X te energizó" (`DamageOverlay` re-propuesto en dorado) | +0.1 |
| Explosión de granada | 2 | Shockwave ring 0→3u en 400ms + flash + 12 partículas | Boom medio | Anillo de carga se descarga | +0.2 |
| MULTI-HYPE (≥3 NPCs) | 2 | Partículas por cada NPC | Acorde corto | Popup "MULTI-HYPE xN +8/extra" | +0.2 |
| VIP aparece / capturado | 2/3 | Tinte dorado + estela / confetti burst | Sub-riser / fanfarria corta | Banner 10s con countdown / "+40 VIP" | 0 / +0.3 |
| HYPE DROP (NPC a 100) | 3 | Baile celebración 3s (ya existe), 40 partículas del pool, shockwave, hit-stop 40ms del NPC | Boom de bajo (seno 60Hz pitch-drop) | "+15 HYPE DROP" grande | +0.3 |
| CLUB DROP (energía 100) | 4 | Flash blanco 100ms, strobes/láseres al máximo, 16 NPCs en baile sincronizado 5s, confetti | Acorde + sub-bass | "+100 CLUB DROP" gigante, borde dorado | +0.5 |
| GLORIA (25s) | 4 | Club a full sostenido, todos bailando | Colchón armónico suave | Borde dorado + "GLORIA — disfruta el set" | — |
| Bajón etapa 2→3 (anti-feedback) | — | Luces 70%→40%, strobes off, NPCs se encorvan y sacan el celular | Zumbido grave breve al cruzar etapa | Barra de energía pulsa en rojo | — |
| Combo sube / expira | 1/— | Borde crosshair cambia color / fade del contador | Nota pentatónica / nada | Barra de decay 4s junto al crosshair | — |
| DROP INMINENTE / VENTANA | 2 | Láseres aceleran | Riser 2s | Banner "🔴 DROP INMINENTE x3 — \<liveTitle\>" | — |
| Especial usado | 3 | Su efecto existente + refuerzo según rol | Sting propio | Popup del nombre | +0.3 |

---

## 5. Capa multiplayer

Regla: **nada es requisito; solo agranda los números y la fiesta.** Solo, todo funciona idéntico con el tuning base.

- **Los disparos por fin existen para otros:** evento ligero por **broadcast** en el canal `'nightclub'` ya existente de `MultiplayerContext` (`channel.send({ type: 'broadcast', event: 'club_fx', payload })` + `.on('broadcast', ...)` — hoy solo hay presence). Payload: `{ kind: 'shot'|'grenade', pos:[x,y,z], dir:[x,y,z], color, charge? }`. **Fire-and-forget, throttle 8 msg/s por jugador** (bajo el límite default ~10/s de Supabase Realtime); cada cliente simula la trayectoria localmente y la renderiza desde el MISMO pool de `Projectiles.tsx` (subir `SHOT_POOL_SIZE` 30→40). Sin estado por frame, sin fiabilidad: es cosmético.
- **Hype-bump jugador a jugador (el "PvP" es un saludo):** impactar a otro jugador nunca daña — su avatar hace flash dorado + micro-baile 0.5s, **ambos +8 pts**, cooldown 5s por pareja. Reutiliza el path `directHits` de `checkHits` y `DamageOverlay` re-propuesto ("\<X\> te energizó").
- **Energía del Club compartida:** eventos `{ kind: 'energy', value, ts }` al cambiar ≥2 puntos; reconciliación **max-wins con timestamp** (sin host, sin migración — el host-authoritative de la 3ª propuesta queda explícitamente descartado por riesgo). Umbral del CLUB DROP +30% por jugador extra presente (100→130→160…) para que con 2+ caigan juntos pero no trivialmente. Eventos `hype_drop` y `club_drop` ajenos se anuncian con popup y chat ("¡\<X\> encendió el club!"); el CLUB DROP y la GLORIA son globales: el logro de uno es el ambiente de todos.
- **NPCs siguen siendo locales** (cosmético, sin sincronizar): divergencia entre clientes es aceptable e invisible; lo compartido es la energía y las celebraciones.

---

## 6. Economía de puntos

**Regla de oro: 0 puntos por presencia o por spamear al aire.** Nueva tabla `POINTS`/`COOLDOWNS` en `ScoreContext.tsx`; el combo (§3 M10) solo lo alimentan acciones de puntería y multiplica lo marcado con ×C.

| Acción | Pts | ×Combo | Cooldown | Nota |
|---|---|---|---|---|
| `shoot` (disparar) | **0** | — | — | Se elimina el +2 al aire |
| `jump` | **0** | — | — | El salto es movilidad; su premio es el airshot |
| `hitNpc` | +2 | ×C | — (limita el arma, 400ms) | |
| `beatShot` | +4 | ×C | — | Sustituye a hitNpc en ese hit |
| `airshot` | +10 | flat | 2s | Bonus sobre el hit |
| `hypeDropNpc` | +15 | ×C | — | |
| `grenadeNpc` | +8/NPC | flat | — | |
| `multiHype` | +8/extra (≥3) | flat | — | |
| `vip` | +40 | flat | — | |
| `clubDrop` | +100 | flat | — | |
| `hypeBump` | +8 (ambos) | flat | 5s/pareja | Reemplaza a `gotHit`/`hitTarget`/`grenadeHit` |
| `danceComplete` | +5 | no | actual | Participación social, se conserva |
| `chat` | +3 | no | 10s | Se conserva |
| `timePerMinute` "Vibing" | +10 | no | 60s | **SOLO si registraste ≥1 hit en ese minuto** — mata el AFK sin castigar al que juega tranquilo |

**Ritmos resultantes (matemática TUNING, verificar en playtest antes de tocar multiplayer):** activo competente ≈ 40 hits/min a mult. medio x2 (~160) + 8-10 hype drops (~250 con mult.) + extras ≈ **200–300 pts/min**; AFK ≈ **0–10 pts/min**. Por eso las **cargas de especial pasan de 100 → 250 pts** (una carga cada ~60-90s, cadencia similar a hoy pero ganada); los umbrales de DESBLOQUEO 100–500 no cambian (curva de poder intra-sesión temprana). El score queda ~90% skill activa, ~10% participación social, 0% presencia. Comunicar el cambio en `GameInstructions` como feature: "gana puntos energizando al club".

Anti-abuso: gate de pointer-lock (M1) elimina el click-spam sobre UI; rate-limit de broadcast 8/s neutraliza macro-clickers en red; `hypeDropNpc` está naturalmente limitado por la inmunidad de 5s del NPC.

---

## 7. Plan de implementación — workstreams paralelos

### FASE 0 — FUNDACIÓN (secuencial, bloquea todo; 1 agente)
Sin esto ningún workstream tiene base estable.
1. **`src/components/club/tuning.ts` (NUEVO):** objeto `TUNING` único con TODAS las constantes del apéndice.
2. **`src/components/club/colliders.ts` (NUEVO):** lista estática de AABBs (paredes desde `MAP.bounds`, plataformas desde las cajas de `Platforms.tsx`, booth) + helper `segmentHitsAABB`.
3. **`src/components/club/playerState.ts` (NUEVO):** módulo de refs singleton `{ position, airborne, danceMove, dancingSince }`; `PlayerDancer` lo escribe cada frame (escritura a ref, cero React).
4. **`ProjectileContext.tsx`:** velocidad/cooldowns desde TUNING; `checkHits` por **segmento** (pos t−dt → t) contra NPCs + jugadores + colliders; blast de granada **esférico 3D**; muerte en pared con evento de chispa.
5. **`PlayerDancer.tsx`:** gate de clicks (solo con pointer lock, ignorar el click adquisidor y UI); dirección de disparo desde cámara (yaw+pitch de `CameraContext`); cooldown 400ms; **física delta-time** (M14) con clamp 50ms; escrituras a `playerState.ts`.
6. Stubs de interfaz para que los WS no se bloqueen: `EnergyContext.tsx` (refs + subscribe, valores dummy) y `beatClock.ts` (API final, ya funcional — es trivial).

### WS-1 — GAMEPLAY (archivos de su propiedad exclusiva)
`HealthContext.tsx` (decay NPC −4/s, estados, reset a 40, inmunidad 5s, VIP flags), `EnergyContext.tsx` (energía, etapas, CLUB DROP, GLORIA, chill mode, ventanas de drop + DROP INMINENTE leyendo `useLive`), `ScoreContext.tsx` (economía §6, combo por hits con ventana 4s, **`playerPosition` fuera de useState → leer de `playerState.ts`** — mata el re-render 60Hz de HUD/Chat, récords a `profiles`), `InstancedDancers.tsx` (lógica de estado: apagado/pose celular vía instanceColor y amplitud, VIP dorado, buff de baile leyendo `playerState`, campos nuevos en `NpcState`: `hitFlashUntil`, `squashT`, `animFreezeUntil` — **los escribe WS-1, los consume WS-2**), `SpecialEffects.tsx` (re-rol de los 5 especiales), `beatClock.ts` (definitivo), `NightclubScene.tsx` (solo el árbol de providers). **Al final, cuando el solo-player esté jugado:** `MultiplayerContext.tsx` (capa broadcast §5 — añadir handlers, NO tocar la lógica de presence existente).

### WS-2 — FEEL/JUICE (mayormente archivos nuevos → paralelizable desde el día 0)
`sounds.ts` (NUEVO, 8 sonidos sintetizados), `juice.ts` (NUEVO: sistema de trauma + kick como refs), `ThirdPersonCamera.tsx` (aplicar trauma-shake y kick leyendo `juice.ts`), `Projectiles.tsx` (muzzle flash pooled, tracer squash&stretch, shockwave rings, arco punteado de granada, chispas de pared), `CrosshairHUD.tsx` (NUEVO: crosshair, hitmarkers, anillo de carga, barra de decay del combo — componente propio para no chocar con WS-4 en ScoreHUD), `DamageOverlay.tsx` (re-propuesta: flash dorado de hype-bump). Integración en `InstancedDancers` (squash/hit-stop consumiendo los campos de WS-1) **se hace después del merge del estado NPC de WS-1** — es el único punto de contacto entre workstreams.

### WS-3 — PERF + ESCENA (independiente; puede mergear en cualquier momento)
`materials.ts` (NUEVO: 4-6 `meshStandardMaterial` compartidos), `DJBooth.tsx` / `Platforms.tsx` / `StageElements.tsx` (compartir materiales — el mayor recorte de los 359 draw calls; **material-sharing, NO mergeGeometries**: la cirugía de merge de ~330 meshes queda descartada por riesgo al look neón), `Lighting.tsx` (7→4 luces + emissive; reactividad a etapas de energía vía subscribe al `EnergyContext` — interfaz ya fijada en Fase 0), `StrobeWalls.tsx` / `LaserFloor.tsx` (suscribirse a `beatClock` y a etapas de energía; strobes simples en calidad baja), drei `Instances` estáticas con `frames={1}` (`JungleDecor`, `Background`, donde aplique), `NightclubCanvas.tsx` (Bloom condicional, dpr cap), `SettingsModal.tsx` (toggle de calidad: Bloom off / strobes simples / partículas ÷2 / shake off — junto al antialias existente).

### WS-4 — HUD + META + ANALYTICS (después de que WS-1 fije interfaces)
`ScoreHUD.tsx` (barra de Energía del Club con etapas, banners de ventana/GLORIA/CLUB DROP, "te faltan N pts para superar a \<X\>" con el `leaderboard` existente, récord personal al entrar), `SessionSummary.tsx` (NUEVO modal, disparado desde "Salir" en `NightclubScene`), `GameInstructions.tsx` (copy nuevo en español: beat-shot, granada, VIP, GLORIA, economía), `Chat.tsx` (chip de título junto al username), migración SQL `best_combo`/`best_club_drops` + espejo en `supabase-schema.sql`, y **tracking obligatorio (CLAUDE.md)**: eventos vía `event()` de `src/lib/gtag.ts` — `club_shot_fired` (muestreado 1/50), `club_hype_drop`, `club_club_drop`, `club_gloria`, `club_vip_caught`, `club_special_used`, `club_hype_bump`, `club_session_summary` (params: `duration_min`, `club_drops`, `best_combo`, `score`), `club_quality_change`; registrar TODOS en el mapa de labels de `src/lib/analyticsLabels.ts`; `club_club_drop` y `club_session_summary` a `CORE_ACTIONS`/`SITE_EVENT_ORDER` + `SITE_EVENT_NAMES` en `src/lib/ga.ts`; el resto a `HIDDEN_ACTIONS`.

### Orden de merge y gates
`FASE 0` → (WS-3 cuando quiera) → `WS-1 núcleo NPC+energía+economía` (**gate: juego mínimo viable — jugarlo solo y validar la matemática TUNING antes de seguir**) → integración `WS-2` en InstancedDancers → `WS-4` → capa multiplayer (final de WS-1) → **pasada de tuning con playtest**. Si el tiempo se corta: el sacrificio ordenado es (último→primero): hype-bump multiplayer → títulos → DROP INMINENTE → VIP → beat-shot (doloroso pero válido, dicho por la propuesta base). Los tiers 0-1 de juice y la Fase 0 NO son recortables.

### Qué NO tocar
- **`MultiplayerContext`**: la lógica de presence/track existente (solo AÑADIR broadcast). Ni el nombre del canal `'nightclub'`.
- **`AuthContext` del club, `AdminAuthContext`, `PkAuthContext`** — contextos aislados a propósito; `supabase.ts` es singleton memoizado, NO crear clientes nuevos (GoTrueClient + Web Locks = getUser colgado).
- **`Chat` realtime, `LiveChat`, `PlaybackContext`, `AudioPlayer`, `LiveScreen`, `WallChatScreen`**, costumes/accessories/faces, `CharacterCustomModal`.
- **`MobileControls`**: el móvil conserva su comportamiento actual (tap dispara plano); el rediseño de puntería es desktop-first. Solo garantizar que compila y no rompe.
- **Layout del mapa (`MAP` en `constants.ts`)**: convertir unidades a /s sí; cambiar geometría/valores de diseño no.
- **Superficies `(main)`/`(admin)`/`pk`** salvo los 3 archivos de analytics listados.
- **`HealthContext.tsx` no se renombra** (evitar churn de imports).
- **Sin dependencias nuevas** (nada de zustand/howler): refs + contexts, WebAudio puro, r3f/three puro, cero assets externos.
- **DB**: solo la migración de 2 columnas, como archivo en `supabase/migrations/` + espejo en `supabase-schema.sql`; se aplica a mano en el SQL Editor — no hay CLI ni service-role en el repo.
- **Proceso (CLAUDE.md)**: gate de verificación `npx tsc --noEmit`, NUNCA `next build` a mitad de trabajo; nunca `pkill` del dev server del usuario ni levantar otro `next dev` en :3600 (curl al server ya corriendo para verificar runtime).

---

## 8. Métricas de éxito

### Performance (medibles en dev, antes de mergear)
- **Draw calls ≤60** en la vista por defecto (hoy 359) — medir con `gl.info.render.calls` logueado en dev; presupuesto: escena estática ≤20, dancers ~8, proyectiles/FX ≤12, resto ≤20.
- **60 fps en laptop media; ≥30 fps en laptop débil con calidad baja** (Bloom off, strobes simples, partículas ÷2, shake off).
- **0 setState por frame**: React Profiler — HUD/Chat NO re-renderizan durante movimiento continuo (verifica la salida de `playerPosition` de React).
- **0 allocations por frame en loops calientes** (sin sierra de GC en la pestaña Performance durante 60s de juego).
- **Física invariante al refresh rate**: altura de salto y velocidad idénticas a 60/120/144Hz (test manual con monitor high-refresh o throttle).
- Instances estáticas suben matrices una vez (`frames=1`), no por frame.

### Diversión / negocio (GA4, comparar 2 semanas antes vs después)
- **Duración media de sesión en `/club` +50%** (la métrica del propósito: más tiempo en el club = más stream visto). Segmentar por `isLive` — la sesión durante live es la que más importa.
- **≥80% de sesiones con ≥1 `club_hype_drop` en el primer minuto** (onboarding implícito funciona).
- **Mediana ≥2 `club_club_drop` por sesión de >5 min** (el ciclo de ~90-120s está bien tuneado; si es 0-1, bajar decay; si es >4, subir umbral).
- **`club_session_summary.duration_min` p50 ≥ 8 min** y % de jugadores que vuelven en 7 días al alza (el leaderboard-gap y los títulos hacen su trabajo).
- **El score AFK ≈ 0**: distribución de `score/min` bimodal (activos 200-300, espectadores ~0) — si aparece una moda intermedia rara, hay un exploit.
- Señal cualitativa: el ratio `club_gloria` completadas sin disparos durante la GLORIA (la gente efectivamente usa el valle para mirar el stream — es la métrica del injerto estrella).

---

## Apéndice — `TUNING` (contenido inicial de `src/components/club/tuning.ts`)

```
ARMA: shotCooldownMs 400 · shotSpeed 22 · shotLifeS 1.2 · shotRadius 0.12
BEAT: bpm 174 · windowMs 80 · beatHypeMult 1.5
NPC:  hypeHit 15 · hypeBeat 22 · hypeGrenade 12 · hypeGrenadeFull 20 · decayPerS 4
      apagadoUmbral 30 · dropResetTo 40 · dropInmuneS 5 · spawnHypeMin 30 · spawnHypeMax 60
ENERGIA: start 40 · decayPerS 1.0 · decayEscalada 1.10 · decayCap 2.0 · porHypeDrop 10
      porVip 15 · porEspecial 10 · etapaMedia 60 · etapaBajon 30 · clubDropUmbral 100
      umbralPorJugadorExtra 0.30 · gloriaS 25 · postGloriaEnergia 55 · chillTrasSinDisparoS 120 · chillTecho 50
VENTANAS: dropEventCadaS [90,120] · dropEventDuraS 20 · dropEventMult 2 · liveCadaS 300 · liveMult 3
VIP:  cadaS [45,60] · duraS 10 · hitsNecesarios 3 · speedMult 2.5
GRANADA: cargaMinS 0.4 · cargaMaxS 1.2 · velMin 8 · velMax 16 · blastRadio 3 · cooldownS 3 · multiHypeDesde 3
COMBO: ventanaS 4 · escalones {3:2, 6:3, 10:4, 15:5}
BAILE: buffRadio 3 · buffTrasS 3 · buffDecayMult 0.5 · buffDuraS 10
AIRSHOT: distanciaMin 8 · cooldownS 2
PUNTOS: (tabla §6) · cargaEspecialCada 250 · umbralesDesbloqueo [100..500]
FISICA: moveSpeed 8.4 u/s · jumpVel 9 u/s · gravity 21.6 u/s² · dtClampMs 50
JUICE: traumaHit 0.15 · traumaExplosion 0.2 · traumaHypeDrop 0.3 · traumaClubDrop 0.5 · traumaDecayPerS 1.8
      hitStopMs 40 · squashMs 120 · muzzleMs 60 · kickPitchDeg 0.6 · kickRecoverMs 120
MULTI: broadcastMaxPerS 8 · hypeBumpCooldownS 5
```

Rutas absolutas clave del repo (worktree): `/Users/alan/Code/drumandbass-landing/.claude/worktrees/contentful-replacement-cms-4e76e0/src/components/club/` (contextos y `components/`), `/Users/alan/Code/drumandbass-landing/.claude/worktrees/contentful-replacement-cms-4e76e0/src/lib/{gtag.ts,ga.ts,analyticsLabels.ts}`, `/Users/alan/Code/drumandbass-landing/.claude/worktrees/contentful-replacement-cms-4e76e0/supabase/migrations/`. Archivos nuevos a crear: `tuning.ts`, `colliders.ts`, `playerState.ts`, `beatClock.ts`, `sounds.ts`, `juice.ts`, `EnergyContext.tsx`, `materials.ts`, `components/CrosshairHUD.tsx`, `components/SessionSummary.tsx`.