'use client';

import { useEffect } from 'react';

// Si la landing se abrió desde un correo de campaña, la URL trae ?ct=<id> (el id
// del destinatario). Hace dos cosas al aterrizar:
//  1) Registra la visita en NUESTRA DB al instante (sin depender de GA).
//  2) Persiste el ct en sessionStorage (scopeado por evento). Así, si el usuario
//     se inscribe por OAuth y vuelve a /evento/[id] SIN el ?ct, las acciones
//     posteriores (copiar el código, etc.) siguen atribuidas al destinatario.
//     sessionStorage sobrevive el ida-y-vuelta del OAuth en la misma pestaña.
// Lee el param de window.location (no useSearchParams) para no forzar la página a
// dinámica ni requerir Suspense.
export default function CampaignVisitBeacon({ eventId }: { eventId?: string }) {
  useEffect(() => {
    const ct = new URLSearchParams(window.location.search).get('ct');
    if (!ct) return;
    if (eventId) {
      try {
        // Guardamos ct + timestamp. Se usa como fallback solo si es reciente (TTL),
        // así un ct viejo no se cuela en una visita orgánica posterior. La URL
        // siempre tiene prioridad sobre esto (ver EventCouponBlock).
        sessionStorage.setItem(`dnb:ct:${eventId}`, JSON.stringify({ ct, at: Date.now() }));
      } catch {
        // sin sessionStorage: se sigue con el ?ct de la URL nomás
      }
    }
    fetch('/api/campaign-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ct }),
      keepalive: true,
    }).catch(() => {});
  }, [eventId]);
  return null;
}
