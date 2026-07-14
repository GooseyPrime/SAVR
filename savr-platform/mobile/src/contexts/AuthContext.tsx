import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../config/supabase';
import { UserData } from '../types';

// Ensures any pending in-app browser OAuth sessions are finalized on mount.
WebBrowser.maybeCompleteAuthSession();

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
          // Map snake_case to camelCase for compatibility
          setUserData({
            uid: data.id,
            email: data.email,
            displayName: data.display_name,
            subscriptionTier: data.subscription_tier as any,
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
    // Build a deep-link redirect URI using the app's registered scheme (savr://).
    // Requires the Google provider to be enabled in the Supabase project settings
    // and the redirect URL registered in Google Cloud Console.
    const redirectUri = makeRedirectUri({ scheme: 'savr', path: 'auth/callback' });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data?.url) throw new Error('No OAuth URL returned from provider');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

    if (result.type === 'success' && result.url) {
      // Verify the callback URL originates from this app's registered scheme before
      // extracting tokens, preventing token injection from malicious redirect URLs.
      if (!result.url.startsWith(redirectUri.split('?')[0])) {
        throw new Error('OAuth callback URL does not match the expected redirect URI');
      }

      // Parse access_token and refresh_token from the callback URL fragment.
      const fragmentParams = new URLSearchParams(result.url.replace(/^[^#]*#/, ''));
      const accessToken = fragmentParams.get('access_token');
      const refreshToken = fragmentParams.get('refresh_token');

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) throw sessionError;
      } else {
        throw new Error('OAuth callback did not return a valid session');
      }
    } else if (result.type === 'cancel' || result.type === 'dismiss') {
      // User dismissed the browser — treat as a cancellation, not an error.
      return;
    } else {
      throw new Error('Google sign-in was not completed');
    }
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
