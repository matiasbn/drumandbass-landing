# Roadmap Club

## Gamificación

### Progresión e Identidad

- **Sistema de niveles** — Rastrea el tiempo pasado en el club o el número de visitas. Los niveles más altos desbloquean nuevos estilos de cara, colores de cuerpo o movimientos de baile exclusivos (teclas 4, 5, 6…).
- **Títulos/insignias** — Se muestran junto al nombre de usuario. Se obtienen mediante hitos como "Primeras 10 visitas", "100 mensajes enviados", "Bailaste 30 min seguidos".

### Social y Competitivo

- **Batallas de baile** — Dos jugadores se enfrentan y se turnan para realizar secuencias de movimientos de baile. Los demás jugadores votan al ganador presionando una tecla.
- **Combos de baile** — Encadenar movimientos (ej. 1-3-2-1) dentro de una ventana de tiempo otorga puntos. Muestra un contador de combo sobre la cabeza del jugador.
- **Medidor de hype colectivo** — Una barra compartida que se llena cuando varios jugadores bailan simultáneamente. Al 100%, se activa un evento visual (confeti, show de láser, cambio de color del suelo).

### Coleccionables y Economía

- **Drops de vinilos** — Discos de vinilo aleatorios aparecen en la pista de baile. Camina sobre ellos para recogerlos. Cada uno tiene un nombre de pista/arte. Construye una colección personal visible en el perfil.
- **Tienda de cosméticos** — Gasta puntos ganados en sombreros, gafas, efectos de brillo o baldosas personalizadas de pista de baile bajo tus pies.

### Eventos y Desafíos

- **Peticiones al DJ** — Los jugadores votan por la siguiente pista de una lista corta. La pista ganadora suena y los votantes obtienen puntos.
- **Simón Dice** — El NPC DJ realiza una secuencia de movimientos, los jugadores la replican. Secuencia correcta = puntos.
- **Desafíos semanales** — "Baila 5 minutos sin parar", "Envía 20 mensajes", "Recoge 3 vinilos".

### Ambiente / Bajo esfuerzo

- **Reacciones** — Reacciones rápidas con emoji (fuego, aplauso, calavera) que flotan sobre tu personaje. Interacción de bajo compromiso.
- **Bonus de sincronización de baile** — Si los jugadores cercanos hacen el mismo movimiento al mismo tiempo, se activa una recompensa visual (anillo de brillo compartido, explosión de partículas).

### Puntos de Partida Sugeridos

Mejor relación esfuerzo-beneficio para implementar primero:

1. **Combos de baile** — Se construye directamente sobre el sistema de movimientos existente (teclas 1-3). Añade un contador de combo y puntuación.
2. **Reacciones** — Asignaciones de teclas simples que transmiten un emoji a través del canal de presencia existente.
3. **Medidor de hype colectivo** — Usa los datos de presencia multijugador existentes para detectar baile simultáneo.
