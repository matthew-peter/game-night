'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/lib/supabase/types';
import { useGameStore } from '@/lib/store/gameStore';

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
    let isMounted = true;
    const supabase = createClient();
    
    // Check for existing session
    const checkUser = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (sessionError || !session?.user) {
          setLoading(false);
          return;
        }
        
        // Get user profile
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (!isMounted) return;
        
        if (profile) {
          setUser(profile);
          setStoreUser(profile);
        }
      } catch (error) {
        console.error('AuthProvider checkUser error:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Run the check
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        
        if (event === 'SIGNED_IN' && session?.user) {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (profile && isMounted) {
            setUser(profile);
            setStoreUser(profile);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setStoreUser(null);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [setStoreUser]);

  const signUp = async (email: string, password: string, username: string) => {
    const supabase = createClient();
    
    try {
      // Check if username is taken
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();
      
      if (existingUser) {
        return { error: 'Username is already taken' };
      }

      // Sign up with Supabase Auth - include username in metadata for the trigger
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        // The database trigger should create the user profile automatically
        // But we'll also try to create it manually as a fallback
        // First check if the profile was created by the trigger
        let { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        // If trigger didn't create it (or failed), create it manually
        if (!profile) {
          const { error: profileError } = await supabase
            .from('users')
            .insert({
              id: data.user.id,
              username,
            });

          if (profileError) {
            // Check if it's a duplicate key error (trigger created it)
            if (!profileError.message.includes('duplicate')) {
              return { error: 'Database error saving new user: ' + profileError.message };
            }
          }

          // Fetch the created profile
          const { data: newProfile } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single();
          
          profile = newProfile;
        }

        if (profile) {
          setUser(profile);
          setStoreUser(profile);
        }
      }

      return {};
    } catch (error) {
      console.error('signUp error:', error);
      return { error: 'An unexpected error occurred' };
    }
  };

  const signIn = async (email: string, password: string) => {
    const supabase = createClient();
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profile) {
          setUser(profile);
          setStoreUser(profile);
        }
      }

      return {};
    } catch (error) {
      console.error('signIn error:', error);
      return { error: 'An unexpected error occurred' };
    }
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setStoreUser(null);
  };

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
