'use client';

// PÁGINA TEMPORAL DE VERIFICACIÓN WS-3 — SOLO DEV, SE BORRA TRAS LA MEDICIÓN.
// Renderiza la escena sin el gate de auth para medir draw calls y validar el look.

import dynamic from 'next/dynamic';
import { AuthProvider } from '@/src/components/club/AuthContext';

const NightclubScene = dynamic(() => import('@/src/components/club/NightclubScene'), {
  ssr: false,
});

export default function ClubPerfTest() {
  if (process.env.NODE_ENV !== 'development') return null;
  return (
    <AuthProvider>
      <NightclubScene />
    </AuthProvider>
  );
}
