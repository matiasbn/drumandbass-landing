-- SUBIDÓN (club shooter) — récords históricos por jugador (M15).
-- best_combo: mejor racha de hits encadenados de todas sus sesiones.
-- best_club_drops: máximo de CLUB DROPs logrados en una sesión (define el
-- título cosmético del chat: ≥1 Warm-up, ≥3 Selector, ≥5 Hype Master).
-- Se aplica a mano en el SQL Editor de Supabase (ver CLAUDE.md).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS best_combo INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS best_club_drops INTEGER DEFAULT 0;
