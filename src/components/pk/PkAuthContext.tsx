'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/src/lib/supabase';
import { PkProfile } from '@/src/types/presskit';

interface PkAuthContextType {
  user: User | null;
  session: Session | null;
  pkProfile: PkProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  createPkProfile: (slug: string) => Promise<{ error: Error | null }>;
  updateSlug: (slug: string) => Promise<{ error: Error | null }>;
  needsPkProfile: boolean;
}

const PkAuthContext = createContext<PkAuthContextType | undefined>(undefined);

export function PkAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [pkProfile, setPkProfile] = useState<PkProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabase] = useState(() => createClient());

  const fetchPkProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/pk/profile');
      if (!res.ok) {
        setPkProfile(null);
        return null;
      }
      const { profile } = await res.json();
      setPkProfile(profile as PkProfile | null);
      return profile as PkProfile | null;
    } catch (err) {
      console.error('Error fetching pk profile:', err);
      setPkProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) {
          console.error('Error getting session:', error);
          setLoading(false);
          return;
        }
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchPkProfile();
        }
      } catch (err) {
        console.error('Error getting session:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchPkProfile();
        } else {
          setPkProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchPkProfile]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/pk/edit`,
        queryParams: { prompt: 'select_account' },
      }
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut({ scope: 'global' });
    setPkProfile(null);
  };

  const createPkProfile = async (slug: string) => {
    try {
      const res = await fetch('/api/pk/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: new Error(data.error || 'Error creando perfil') };
      }
      setPkProfile(data.profile);
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const updateSlug = async (slug: string) => {
    try {
      const res = await fetch('/api/pk/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: new Error(data.error || 'Error actualizando slug') };
      }
      setPkProfile(data.profile);
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const needsPkProfile = !!user && !loading && !pkProfile;

  return (
    <PkAuthContext.Provider
      value={{
        user,
        session,
        pkProfile,
        loading,
        signInWithGoogle,
        signOut,
        createPkProfile,
        updateSlug,
        needsPkProfile,
      }}
    >
      {children}
    </PkAuthContext.Provider>
  );
}

export function usePkAuth() {
  const context = useContext(PkAuthContext);
  if (context === undefined) {
    throw new Error('usePkAuth must be used within a PkAuthProvider');
  }
  return context;
}
