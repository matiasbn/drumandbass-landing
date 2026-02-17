'use client';

import dynamic from 'next/dynamic';
import { AuthProvider, useAuth } from '../../../components/club/AuthContext';
import { AuthModal } from '../../../components/club/components/AuthModal';

const NightclubScene = dynamic(() => import('../../../components/club/NightclubScene'), {
  ssr: false,
});

function ClubContent() {
  const { user, profile, loading, needsProfile } = useAuth();

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
            Drum and BASS CHILE
          </h1>
          <p className="text-white/50 font-mono text-sm tracking-widest">CLUB VIRTUAL</p>
        </div>

        <AuthModal isOpen={true} canClose={false} />
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
