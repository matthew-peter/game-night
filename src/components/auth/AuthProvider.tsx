'use client';

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User } from '@/lib/supabase/types';
import { useGameStore } from '@/lib/store/gameStore';
import { createClient } from '@/lib/supabase/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const setStoreUser = useGameStore((state) => state.setUser);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const supabase = createClient();

    const init = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('[Auth] getSession error:', sessionError.message);
        }
        if (data.session?.user) {
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.session.user.id)
            .single();
          if (profileError) {
            console.error('[Auth] profile fetch error:', profileError.message, profileError.code);
          }
          if (profile) {
            setUser(profile);
            setStoreUser(profile);
          } else {
            // Fallback: use auth user data so we don't lose the session
            console.warn('[Auth] No profile found, using auth user data as fallback');
            const fallback = {
              id: data.session.user.id,
              username: data.session.user.user_metadata?.username || data.session.user.email?.split('@')[0] || 'Player',
              created_at: data.session.user.created_at,
            };
            setUser(fallback);
            setStoreUser(fallback);
          }
        }
      } catch (err) {
        console.error('[Auth] init error:', err);
      }
      setLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setStoreUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [setStoreUser]);

  async function signUp(email: string, password: string, username: string): Promise<{ error?: string }> {
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });

    if (error) return { error: error.message };

    if (data.user) {
      await supabase.from('users').insert({ id: data.user.id, username });
      const profile = { id: data.user.id, username, created_at: new Date().toISOString() };
      setUser(profile);
      setStoreUser(profile);
    }

    return {};
  }

  async function signIn(email: string, password: string): Promise<{ error?: string }> {
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.error('[Auth] signIn error:', error.message);
      return { error: error.message };
    }

    if (data.user) {
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('[Auth] signIn profile error:', profileError.message, profileError.code);
      }

      if (profile) {
        setUser(profile);
        setStoreUser(profile);
      } else {
        // Fallback: use auth user data
        const fallback = {
          id: data.user.id,
          username: data.user.user_metadata?.username || email.split('@')[0] || 'Player',
          created_at: data.user.created_at,
        };
        setUser(fallback);
        setStoreUser(fallback);
      }
    }

    return {};
  }

  async function signOut(): Promise<void> {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setStoreUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
