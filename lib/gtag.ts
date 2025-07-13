"use client";

/**
 * Envía un evento a Google Analytics.
 * @param action - El nombre de la acción del evento (ej: 'button_click').
 * @param params - Un objeto con los parámetros del evento.
 */
export const event = (action: string, params?: Record<string, any>) => {
  if (typeof window.gtag === "function") {
    window.gtag("event", action, params);
  }
};
