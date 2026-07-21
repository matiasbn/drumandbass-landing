'use client';

import { useEffect } from 'react';

// Si la landing se abrió desde un correo de campaña, la URL trae ?ct=<id> (el id
// del destinatario). Registramos la visita en NUESTRA DB al instante — sin depender
// de GA. Lee el param de window.location (no useSearchParams) para no forzar la
// página a dinámica ni requerir Suspense.
export default function CampaignVisitBeacon() {
  useEffect(() => {
    const ct = new URLSearchParams(window.location.search).get('ct');
    if (!ct) return;
    fetch('/api/campaign-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ct }),
      keepalive: true,
    }).catch(() => {});
  }, []);
  return null;
}
