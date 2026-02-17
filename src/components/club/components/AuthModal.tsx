'use client';

import React, { useState } from 'react';
import { RiCloseLine, RiGoogleFill, RiAppleFill, RiUserLine, RiAtLine } from '@remixicon/react';
import { useAuth } from '../AuthContext';

type AuthView = 'login' | 'profile';

const ENABLED_PROVIDERS = {
  google: true,
  apple: false,
};

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  initialView?: AuthView;
  canClose?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialView = 'login',
  canClose = true,
}) => {
  const [view, setView] = useState<AuthView>(initialView);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const { signInWithGoogle, signInWithApple, updateProfile, needsProfile } = useAuth();

  // Show profile setup if needed
  const currentView = needsProfile ? 'profile' : view;

  if (!isOpen) return null;

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (username.length < 3 || username.length > 20) {
      setError('El nombre de usuario debe tener entre 3 y 20 caracteres');
      setLoading(false);
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('El nombre de usuario solo puede contener letras, números y guiones bajos');
      setLoading(false);
      return;
    }

    const { error } = await updateProfile({ name, username });
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

  const handleAppleLogin = async () => {
    setError('');
    const { error } = await signInWithApple();
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
            {currentView === 'profile' && 'COMPLETAR PERFIL'}
          </h2>
          {canClose && !needsProfile && onClose && (
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

          {success && (
            <div className="p-3 bg-green-500/20 border border-green-500/50 text-green-400 font-mono text-xs">
              {success}
            </div>
          )}

          {/* Profile Setup View */}
          {currentView === 'profile' && (
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <p className="text-white/70 font-mono text-xs mb-4">
                Completa tu perfil para entrar al club
              </p>

              <div className="relative">
                <RiUserLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  placeholder="Nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`${inputClass} pl-11`}
                  required
                  minLength={2}
                  maxLength={50}
                />
              </div>

              <div className="relative">
                <RiAtLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  placeholder="Nombre de usuario"
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                  }
                  className={`${inputClass} pl-11`}
                  required
                  minLength={3}
                  maxLength={20}
                />
              </div>

              <p className="text-white/40 font-mono text-[10px]">
                3-20 caracteres, solo letras, números y guiones bajos
              </p>

              <button type="submit" disabled={loading} className={primaryButtonClass}>
                {loading ? 'GUARDANDO...' : 'ENTRAR AL CLUB'}
              </button>
            </form>
          )}

          {/* Login View */}
          {currentView === 'login' && (
            <>
              {/* OAuth buttons */}
              <div className="space-y-3">
                {ENABLED_PROVIDERS.google && (
                  <button onClick={handleGoogleLogin} className={secondaryButtonClass}>
                    <span className="flex items-center justify-center gap-3">
                      <RiGoogleFill className="w-5 h-5" />
                      CONTINUAR CON GOOGLE
                    </span>
                  </button>
                )}

                {ENABLED_PROVIDERS.apple && (
                  <button onClick={handleAppleLogin} className={secondaryButtonClass}>
                    <span className="flex items-center justify-center gap-3">
                      <RiAppleFill className="w-5 h-5" />
                      CONTINUAR CON APPLE
                    </span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10">
          <p className="text-white/30 font-mono text-[10px] text-center">
            Drum and Bass CHILE // CLUB VIRTUAL
          </p>
        </div>
      </div>
    </div>
  );
};
