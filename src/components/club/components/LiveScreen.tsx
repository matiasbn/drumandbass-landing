'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { DEFAULT_CLUB_VIDEO_ID, DEFAULT_CLUB_VIDEO_START } from '@/src/lib/clubStream';

interface LiveScreenProps {
  isLive: boolean;
  youtubeVideoId?: string | null;
}

export const LiveScreen: React.FC<LiveScreenProps> = ({ isLive, youtubeVideoId }) => {
  const glowRef = useRef<THREE.Mesh>(null);
  const indicatorRef = useRef<THREE.Mesh>(null);
  const [interacting, setInteracting] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // AUTOPLAY: el video parte MUTEADO (única forma de que un navegador lo deje
  // arrancar solo) y se le quita el mute en el primer gesto del usuario —
  // siempre ocurre, porque hay que hacer clic para tomar el mouse.
  //
  // OJO: el <iframe> queda fuera del viewport casi todo el rato (la pantalla
  // está en lo alto del club), y en ese caso YouTube ignora el `autoplay=1` del
  // src. Por eso no basta con pedirlo una vez: se insiste con `playVideo` vía
  // la API del iframe hasta que el player confirme que está reproduciendo.
  useEffect(() => {
    if (!youtubeVideoId) return;

    let playing = false;
    let unmuted = false;
    let interacted = false;
    let intentos = 0;

    const post = (func: string) => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args: [] }),
        '*',
      );
    };

    // El player sólo informa su estado si antes le mandamos el handshake.
    const onMessage = (e: MessageEvent) => {
      if (typeof e.data !== 'string' || !e.origin.includes('youtube')) return;
      try {
        const info = JSON.parse(e.data)?.info;
        if (typeof info?.playerState === 'number') playing = info.playerState === 1;
        if (typeof info?.muted === 'boolean') unmuted = !info.muted;
      } catch {
        // el player también manda mensajes que no son JSON
      }
    };

    const onInteract = () => {
      interacted = true;
      post('unMute');
      post('playVideo');
    };

    const timer = window.setInterval(() => {
      intentos += 1;
      iframeRef.current?.contentWindow?.postMessage(
        '{"event":"listening","id":1,"channel":"widget"}',
        '*',
      );
      if (!playing) post('playVideo');
      if (interacted && !unmuted) post('unMute');
      // Listo (o nos rendimos a los ~40s para no quedar insistiendo si el
      // usuario pausó el video a propósito).
      if ((playing && (!interacted || unmuted)) || intentos > 40) {
        window.clearInterval(timer);
      }
    }, 1000);

    window.addEventListener('message', onMessage);
    window.addEventListener('pointerdown', onInteract);
    window.addEventListener('keydown', onInteract);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('message', onMessage);
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('keydown', onInteract);
    };
  }, [youtubeVideoId]);

  useFrame(({ clock }) => {
    if (!isLive) return;
    const t = clock.getElapsedTime();
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.3 + Math.sin(t * 2) * 0.15;
    }
    if (indicatorRef.current) {
      indicatorRef.current.visible = Math.sin(t * 3) > -0.3;
    }
  });

  return (
    // Pantalla ALTA, ATRÁS e INCLINADA hacia abajo (como las de un venue):
    // arriba del todo y retranqueada para que no estorbe a nadie, con bastante
    // ángulo para que se siga leyendo bien desde la pista.
    <group position={[0, 14, -17.5]} rotation={[0.32, 0, 0]}>
      {/* Screen frame */}
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[15.2, 8.7, 0.1]} />
        <meshStandardMaterial color="#111111" />
      </mesh>

      {/* Screen surface */}
      <mesh ref={glowRef}>
        <planeGeometry args={[14.4, 8.1]} />
        <meshStandardMaterial
          color={youtubeVideoId ? '#000000' : '#050508'}
          emissive={isLive && !youtubeVideoId ? '#4444ff' : '#000000'}
          emissiveIntensity={isLive && !youtubeVideoId ? 0.3 : 0}
        />
      </mesh>

      {/* YouTube iframe — suena el live si lo hay, y si no el video por defecto */}
      {youtubeVideoId && (
        <Html
          transform
          position={[0, 0.2, 0.02]}
          distanceFactor={9.3}
          zIndexRange={[10, 0]}
          style={{
            width: 640,
            height: 360,
          }}
          wrapperClass={interacting ? '' : 'pointer-events-none'}
        >
          <div style={{ position: 'relative', width: 640, height: 360 }}>
            <iframe
              ref={iframeRef}
              data-testid="youtube-iframe"
              src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&mute=1&enablejsapi=1&rel=0&playsinline=1${
                youtubeVideoId === DEFAULT_CLUB_VIDEO_ID
                  ? `&start=${DEFAULT_CLUB_VIDEO_START}&loop=1&playlist=${DEFAULT_CLUB_VIDEO_ID}`
                  : ''
              }`}
              style={{ width: 640, height: 360, border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            {!interacting && (
              <div
                onClick={() => setInteracting(true)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 1,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                }}
              />
            )}
          </div>
        </Html>
      )}

      {/* LIVE indicator */}
      {isLive && (
        <mesh ref={indicatorRef} position={[6.4, 3.5, 0.02]}>
          <circleGeometry args={[0.22, 16]} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2} />
        </mesh>
      )}
    </group>
  );
};
