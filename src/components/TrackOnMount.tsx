'use client';

import { useEffect } from 'react';
import { event } from '@/src/lib/gtag';

// Dispara un evento de GA una vez al montar. Sirve para páginas server-rendered
// donde queremos registrar una "acción" al entrar (ej: ver un presskit, entrar
// al club). El evento solo se envía en producción (el helper es no-op sin gtag).
export default function TrackOnMount({
  name,
  params,
}: {
  name: string;
  params?: Record<string, unknown>;
}) {
  useEffect(() => {
    event(name, params);
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
