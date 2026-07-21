// Estado caliente del jugador local — módulo singleton de refs, CERO React.
// PlayerDancer lo escribe cada frame; ScoreContext (posición), airshots (M8) y
// el buff de baile (M11) lo leen sin provocar re-renders.

export interface PlayerState {
  /** Posición del jugador (pies, y = altura sobre el suelo/plataforma) */
  position: { x: number; y: number; z: number };
  /** true si está en el aire (salto o caída) — lo lee el airshot (M8) */
  airborne: boolean;
  /** Baile activo (0 = ninguno, 1-5 = teclas de baile) */
  danceMove: number;
  /** performance.now() ms en que empezó el baile actual; 0 si no baila (M11: buff tras ≥3s) */
  dancingSince: number;
}

export const playerState: PlayerState = {
  position: { x: 0, y: 0, z: 6 },
  airborne: false,
  danceMove: 0,
  dancingSince: 0,
};

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Setter barato de pose — llamar una vez por frame desde PlayerDancer. */
export function setPlayerPose(x: number, y: number, z: number, airborne: boolean): void {
  playerState.position.x = x;
  playerState.position.y = y;
  playerState.position.z = z;
  playerState.airborne = airborne;
}

/** Setter barato de baile — gestiona dancingSince en las transiciones. */
export function setPlayerDance(danceMove: number): void {
  if (danceMove === playerState.danceMove) return;
  playerState.danceMove = danceMove;
  playerState.dancingSince = danceMove > 0 ? nowMs() : 0;
}
