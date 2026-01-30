"use client";

declare global {
  interface Window {
    gtag?: (command: "config" | "event" | "js", ...args: unknown[]) => void;
  }
}

/**
 * Envía un evento a Google Analytics.
 * @param action - El nombre de la acción del evento (ej: 'button_click').
 * @param params - Un objeto con los parámetros del evento.
 */
export const event = (action: string, params?: Record<string, unknown>) => {
  if (typeof window.gtag === "function") {
    window.gtag("event", action, params);
  }
};
