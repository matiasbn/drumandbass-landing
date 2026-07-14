'use client';

import React, { useState } from 'react';
import { RiCloseLine, RiGoogleFill, RiLinkM, RiLoader4Line } from '@remixicon/react';
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
    'w-full px-4 py-3 bg-white brutalist-border text-black font-mono text-sm focus:shadow-[4px_4px_0px_0px_rgba(255,0,85,1)] focus:outline-none transition-all';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-white brutalist-border brutalist-shadow">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-4 border-black">
          <h2 className="text-2xl lg:text-3xl font-black uppercase italic tracking-tighter leading-none">
            {currentView === 'login' && 'Iniciar sesión'}
            {currentView === 'slug-setup' && 'Elige tu DJ name'}
          </h2>
          {!needsPkProfile && onClose && (
            <button
              onClick={onClose}
              className="p-1 opacity-50 hover:opacity-100 transition-opacity shrink-0"
              title="Cerrar"
            >
              <RiCloseLine className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border-4 border-red-500 text-red-600 mono text-xs font-bold">
              {error}
            </div>
          )}

          {/* Slug Setup View */}
          {currentView === 'slug-setup' && (
            <form onSubmit={handleSlugSetup} className="space-y-4">
              <p className="mono text-sm opacity-70">
                Elige tu nombre de DJ. Este será la URL de tu presskit.
              </p>

              {user?.email && (
                <div>
                  <label className="mono text-xs font-bold uppercase block mb-1 opacity-60">
                    Tu cuenta
                  </label>
                  <div className="px-4 py-3 bg-gray-100 brutalist-border mono text-xs opacity-60 truncate">
                    {user.email}
                  </div>
                </div>
              )}

              <div>
                <label className="mono text-sm font-bold uppercase block mb-1">
                  Tu nombre de usuario
                </label>
                <div className="relative">
                  <RiLinkM className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40 z-10" />
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
              </div>

              <div className="px-4 py-3 bg-gray-100 brutalist-border mono text-xs">
                Tu presskit estará en:{' '}
                <span className="text-[#ff0055] font-bold">/pk/{slug || 'tu-nombre'}</span>
              </div>

              <p className="mono text-[10px] opacity-40">
                3-30 caracteres, solo letras minúsculas, números y guiones
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#ff0055] text-white px-6 py-3 font-black uppercase tracking-wider brutalist-border border-black hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? (
                  <>
                    <RiLoader4Line className="w-5 h-5 animate-spin" />
                    CREANDO...
                  </>
                ) : (
                  'CREAR MI PRESSKIT'
                )}
              </button>
            </form>
          )}

          {/* Login View */}
          {currentView === 'login' && (
            <div className="space-y-4">
              <p className="mono text-sm opacity-70">
                Inicia sesión para crear o editar tu presskit
              </p>
              <button
                onClick={handleGoogleLogin}
                className="w-full inline-flex items-center justify-center gap-3 bg-white text-black px-6 py-3 font-black uppercase tracking-wider brutalist-border border-black hover:bg-black hover:text-white transition-colors"
              >
                <RiGoogleFill className="w-5 h-5" />
                Continuar con Google
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t-4 border-black">
          <p className="mono text-[10px] font-bold uppercase opacity-40 text-center">
            Drum and Bass CHILE // PRESSKIT
          </p>
        </div>
      </div>
    </div>
  );
};
