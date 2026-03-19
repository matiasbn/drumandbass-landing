'use client';

import React, { useState } from 'react';
import { RiCloseLine, RiGoogleFill, RiLinkM } from '@remixicon/react';
import { usePkAuth } from './PkAuthContext';

type PkAuthView = 'login' | 'slug-setup';

interface PkAuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const PkAuthModal: React.FC<PkAuthModalProps> = ({ isOpen, onClose }) => {
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signInWithGoogle, createPkProfile, needsPkProfile, user } = usePkAuth();

  const currentView: PkAuthView = needsPkProfile ? 'slug-setup' : 'login';

  if (!isOpen) return null;

  const handleSlugSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanSlug = slug.trim().toLowerCase();

    if (cleanSlug.length < 3 || cleanSlug.length > 30) {
      setError('El nombre debe tener entre 3 y 30 caracteres');
      setLoading(false);
      return;
    }

    if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
      setError('Solo letras minúsculas, números y guiones');
      setLoading(false);
      return;
    }

    const { error } = await createPkProfile(cleanSlug);
    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setError('');
    const { error } = await signInWithGoogle();
    if (error) setError(error.message);
  };

  const inputClass =
    'w-full px-4 py-3 bg-black/50 border border-white/20 text-white font-mono text-sm focus:border-[#ff0055] focus:outline-none transition-colors';
  const buttonClass = 'w-full py-3 font-mono text-sm tracking-wider transition-all';
  const primaryButtonClass = `${buttonClass} bg-[#ff0055] text-white hover:bg-[#ff0055]/80 disabled:opacity-50`;
  const secondaryButtonClass = `${buttonClass} border border-white/30 text-white hover:bg-white/10`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-[#0a0a0a] border border-white/20 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-xl font-mono text-white tracking-wider">
            {currentView === 'login' && 'INICIAR SESIÓN'}
            {currentView === 'slug-setup' && 'ELIGE TU DJ NAME'}
          </h2>
          {!needsPkProfile && onClose && (
            <button
              onClick={onClose}
              className="p-1 text-white/60 hover:text-white transition-colors"
            >
              <RiCloseLine className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 text-red-400 font-mono text-xs">
              {error}
            </div>
          )}

          {/* Slug Setup View */}
          {currentView === 'slug-setup' && (
            <form onSubmit={handleSlugSetup} className="space-y-4">
              <p className="text-white/70 font-mono text-xs mb-4">
                Elige tu nombre de DJ. Este será la URL de tu presskit.
              </p>

              {user?.email && (
                <div className="px-3 py-2 bg-white/5 border border-white/10 text-white/50 font-mono text-xs truncate">
                  {user.email}
                </div>
              )}

              <div className="relative">
                <RiLinkM className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  placeholder="tu-nombre-dj"
                  value={slug}
                  onChange={(e) =>
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                  }
                  className={`${inputClass} pl-11`}
                  required
                  minLength={3}
                  maxLength={30}
                />
              </div>

              <div className="px-3 py-2 bg-white/5 border border-white/10 text-white/50 font-mono text-xs">
                Tu presskit estará en: <span className="text-[#ff0055]">/pk/{slug || 'tu-nombre'}</span>
              </div>

              <p className="text-white/40 font-mono text-[10px]">
                3-30 caracteres, solo letras minúsculas, números y guiones
              </p>

              <button type="submit" disabled={loading} className={primaryButtonClass}>
                {loading ? 'CREANDO...' : 'CREAR MI PRESSKIT'}
              </button>
            </form>
          )}

          {/* Login View */}
          {currentView === 'login' && (
            <div className="space-y-3">
              <p className="text-white/70 font-mono text-xs mb-4">
                Inicia sesión para crear o editar tu presskit
              </p>
              <button onClick={handleGoogleLogin} className={secondaryButtonClass}>
                <span className="flex items-center justify-center gap-3">
                  <RiGoogleFill className="w-5 h-5" />
                  CONTINUAR CON GOOGLE
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10">
          <p className="text-white/30 font-mono text-[10px] text-center">
            Drum and Bass CHILE // PRESSKIT
          </p>
        </div>
      </div>
    </div>
  );
};
