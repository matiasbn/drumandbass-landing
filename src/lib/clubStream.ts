// Video que suena en la pantalla del club cuando NO hay transmisión en vivo,
// para que el lugar nunca quede en silencio y con la pantalla apagada.
//
// OJO: esto NO marca el club como "en vivo". `isLive` sigue reflejando una
// transmisión real (de ahí dependen los rounds y el chat del live); este video
// es sólo ambiente.
export const DEFAULT_CLUB_VIDEO_ID = '6DPls9WctrY';

/** Segundo en el que arranca el video por defecto (1:34). */
export const DEFAULT_CLUB_VIDEO_START = 94;
