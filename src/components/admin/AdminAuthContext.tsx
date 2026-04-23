'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient, UserProfile } from '@/src/lib/supabase';

interface AdminAuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [supabase] = useState(() => createClient());

  const fetchAdminProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/profile');
      const data = await res.json();
      setProfile(data.profile as UserProfile | null);
      setIsAdmin(data.isAdmin === true);
    } catch (err) {
      console.error('Error fetching admin profile:', err);
      setProfile(null);
      setIsAdmin(false);
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
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchAdminProfile();
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
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchAdminProfile();
        } else {
          setProfile(null);
          setIsAdmin(false);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchAdminProfile]);

  const signInWithGoogle = async () => {
    document.cookie = 'pk_auth_redirect=/admin; path=/; max-age=600; SameSite=Lax';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      }
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut({ scope: 'global' });
    setProfile(null);
    setIsAdmin(false);
  };

  return (
    <AdminAuthContext.Provider value={{ user, profile, loading, isAdmin, signInWithGoogle, signOut }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
