/**
 * SAVR Authentication Context
 * Single source of truth for authentication state across the app
 * Handles session hydration, state changes, and sync with Zustand store
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/store/app-store';

export type AuthState = 'loading' | 'guest' | 'authenticated' | 'expired' | 'signed-out';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  authState: AuthState;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authState, setAuthState] = useState<AuthState>('loading');
  const { setAuthenticated, preferences } = useAppStore();

  // Determine auth state from session/user
  const deriveAuthState = useCallback((currentSession: Session | null, currentUser: User | null): AuthState => {
    if (!supabase) return 'guest'; // No Supabase client = guest mode only
    
    if (currentSession && currentUser) {
      // Check if session is expired
      const expiresAt = currentSession.expires_at;
      if (expiresAt && Date.now() / 1000 > expiresAt) {
        return 'expired';
      }
      return 'authenticated';
    }
    
    // If onboarding completed but no session, they're a guest
    if (preferences.onboardingCompleted) {
      return 'guest';
    }
    
    return 'signed-out';
  }, [preferences.onboardingCompleted]);

  // Sign out handler
  const signOut = useCallback(async () => {
    if (!supabase) return;
    
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setAuthState('signed-out');
    setAuthenticated(false);
  }, [setAuthenticated]);

  // Refresh session
  const refreshSession = useCallback(async () => {
    if (!supabase) return;
    
    const { data: { session: newSession } } = await supabase.auth.refreshSession();
    if (newSession) {
      setSession(newSession);
      setUser(newSession.user);
      setAuthState('authenticated');
      setAuthenticated(true);
    }
  }, [setAuthenticated]);

  // Initialize auth state on mount
  useEffect(() => {
    if (!supabase) {
      setAuthState('guest');
      return;
    }

    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { user: initialUser }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !initialUser) {
          setAuthState(deriveAuthState(null, null));
          setAuthenticated(false);
          return;
        }

        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        setUser(initialUser);
        setSession(initialSession);
        const state = deriveAuthState(initialSession, initialUser);
        setAuthState(state);
        setAuthenticated(state === 'authenticated');
      } catch {
        setAuthState('signed-out');
        setAuthenticated(false);
      }
    };

    initAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        const currentUser = currentSession?.user ?? null;
        
        setSession(currentSession);
        setUser(currentUser);
        
        switch (event) {
          case 'SIGNED_IN':
          case 'TOKEN_REFRESHED':
            setAuthState('authenticated');
            setAuthenticated(true);
            break;
          case 'SIGNED_OUT':
            setAuthState('signed-out');
            setAuthenticated(false);
            break;
          case 'USER_DELETED':
            setAuthState('signed-out');
            setAuthenticated(false);
            break;
          default:
            setAuthState(deriveAuthState(currentSession, currentUser));
            setAuthenticated(currentSession !== null && currentUser !== null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [setAuthenticated, deriveAuthState]);

  const value: AuthContextValue = {
    user,
    session,
    authState,
    isLoading: authState === 'loading',
    isAuthenticated: authState === 'authenticated',
    isGuest: authState === 'guest',
    signOut,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
