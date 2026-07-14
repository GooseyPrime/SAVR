import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { UserData } from '../types';
import { SubscriptionTier } from '../lib/billing';
import { signInWithGoogle as googleOAuthSignIn } from '../lib/google-auth';

/** Normalize a raw database tier value to a canonical SubscriptionTier. */
function normalizeLegacyTier(raw: string | null | undefined): SubscriptionTier {
  if (raw === 'free')    return 'basic';
  if (raw === 'plus')    return 'pro';
  if (raw === 'premium') return 'pro';
  if (raw === 'pro')     return 'pro';
  return 'basic';
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchUserData(session.user.id);
        } else {
          setUserData(null);
          setLoading(false);
        }
      }
    );

    const fetchUserData = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          console.error('Error fetching user data:', error);
          setUserData(null);
        } else if (data) {
          // Map snake_case to camelCase; normalize any legacy tier values to canonical.
          setUserData({
            uid: data.id,
            email: data.email,
            displayName: data.display_name,
            subscriptionTier: normalizeLegacyTier(data.subscription_tier),
            subscriptionStatus: data.subscription_status,
            createdAt: data.created_at ? new Date(data.created_at) : new Date(),
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    const result = await googleOAuthSignIn();
    if (!result.success) {
      if (result.reason === 'canceled') {
        // User dismissed the browser — do not throw; let the UI remain idle.
        return;
      }
      // Surface browser errors, invalid callbacks, and exchange failures.
      throw new Error(result.message);
    }
    // On success, onAuthStateChange fires automatically and updates user state.
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = {
    user,
    userData,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
