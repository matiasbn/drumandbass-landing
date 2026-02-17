'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { RiYoutubeLine } from '@remixicon/react';
import { AuthProvider, useAuth } from '../../../components/club/AuthContext';
import { AuthModal } from '../../../components/club/components/AuthModal';

const NightclubScene = dynamic(() => import('../../../components/club/NightclubScene'), {
  ssr: false,
});

function ClubContent() {
  const { user, profile, loading, needsProfile } = useAuth();
  const [subscribeSeen, setSubscribeSeen] = useState(true);

  useEffect(() => {
    if (user) {
      setSubscribeSeen(localStorage.getItem(`yt_sub_${user.id}`) === '1');
    }
  }, [user]);

  const handleContinue = () => {
    if (user) {
      localStorage.setItem(`yt_sub_${user.id}`, '1');
    }
    setSubscribeSeen(true);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#ff0055] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 font-mono text-sm">CARGANDO...</p>
        </div>
      </div>
    );
  }

  // Show auth modal if not logged in or needs profile
  if (!user || needsProfile) {
    return (
      <div className="w-full h-screen bg-black">
        {/* Background visual */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#ff0055]/20 via-black to-[#00ff41]/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#ff0055]/10 rounded-full blur-[120px]" />
        </div>

        {/* Logo */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center z-10">
          <h1 className="text-3xl md:text-4xl font-mono text-white tracking-wider mb-2">
            Drum and Bass CHILE
          </h1>
          <p className="text-white/50 font-mono text-sm tracking-widest">CLUB VIRTUAL</p>
        </div>

        <AuthModal isOpen={true} canClose={false} />
      </div>
    );
  }

  // Show YouTube subscribe screen for first-time users
  if (!subscribeSeen) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#FF0000]/20 via-black to-[#ff0055]/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FF0000]/10 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-md mx-4 text-center space-y-6">
          <RiYoutubeLine className="w-16 h-16 text-[#FF0000] mx-auto" />
          <h2 className="text-2xl md:text-3xl font-mono text-white tracking-wider">
            AYÚDANOS A CRECER
          </h2>
          <p className="text-white/60 font-mono text-sm leading-relaxed">
            Estamos construyendo una comunidad de Drum and Bass en Chile y tu apoyo es importante.
            <br />
            Suscríbete a nuestro canal de YouTube para ayudarnos a seguir creciendo y dar
            visibilidad a la escena.
          </p>

          <div className="space-y-3 pt-2">
            <a
              href="https://www.youtube.com/@drumandbasschile?sub_confirmation=1"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full py-4 bg-[#FF0000] text-white font-mono text-sm tracking-wider hover:bg-[#FF0000]/80 transition-all border border-[#FF0000]"
            >
              <RiYoutubeLine className="w-5 h-5" />
              SUSCRIBIRME EN YOUTUBE
            </a>
            <button
              onClick={handleContinue}
              className="w-full py-3 font-mono text-sm tracking-wider text-white/40 hover:text-white/70 transition-colors"
            >
              YA ESTOY SUSCRITO — ENTRAR AL CLUB
            </button>
          </div>
        </div>
      </div>
    );
  }

  // User is authenticated and has profile - show the club
  return <NightclubScene />;
}

export default function ClubClient() {
  return (
    <AuthProvider>
      <ClubContent />
    </AuthProvider>
  );
}
