'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { User } from '@/lib/supabase/types';
import { useGameStore } from '@/lib/store/gameStore';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

  useEffect(() => {
    let mounted = true;

    // Set a timeout - if getSession takes too long, just continue
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.log('Session check timed out, continuing without session');
        setLoading(false);
      }
    }, 3000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        clearTimeout(timeout);
        
        if (session?.user) {
          // Load profile in background, don't block
          supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single()
            .then(({ data }) => {
              if (mounted && data) {
                setUser(data);
                setStoreUser(data);
              }
            });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Session check error:', err);
        if (mounted) {
          clearTimeout(timeout);
          setLoading(false);
        }
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setStoreUser(null);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [setStoreUser]);

  async function signUp(email: string, password: string, username: string): Promise<{ error?: string }> {
    console.log('signUp called');
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });

    console.log('signUp result:', { data, error });

    if (error) {
      return { error: error.message };
    }

    if (data.user) {
      // Create profile immediately
      const { error: insertError } = await supabase.from('users').insert({ 
        id: data.user.id, 
        username 
      });
      
      console.log('profile insert result:', { insertError });
      
      if (!insertError) {
        const profile = { id: data.user.id, username, created_at: new Date().toISOString() };
        setUser(profile);
        setStoreUser(profile);
      }
    }

    return {};
  }

  async function signIn(email: string, password: string): Promise<{ error?: string }> {
    console.log('signIn called');
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log('signIn result:', { error: error?.message, user: data?.user?.id });

    if (error) {
      return { error: error.message };
    }

    if (data.user) {
      // Load profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();
      
      console.log('profile loaded:', profile);
      
      if (profile) {
        setUser(profile);
        setStoreUser(profile);
      }
    }

    return {};
  }

  async function signOut(): Promise<void> {
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
