/**
 * Auth Callback Page
 * Handles OAuth and email confirmation redirects from Supabase
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/store/app-store';
import { Logo } from '@/components/brand/Logo';

type CallbackState = 'processing' | 'success' | 'error' | 'expired';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setAuthenticated, completeOnboarding } = useAppStore();
  const [state, setState] = useState<CallbackState>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      if (!supabase) {
        setErrorMessage('Database connection unavailable');
        setState('error');
        return;
      }

      try {
        // Parse hash params
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');
        const errorCode = hashParams.get('error_code');
        const errorDescription = hashParams.get('error_description');

        // Check for errors first
        if (errorCode) {
          if (errorCode === 'access_denied' || errorDescription?.includes('expired')) {
            setState('expired');
            setErrorMessage('This link has expired. Please request a new one.');
          } else {
            setState('error');
            setErrorMessage(errorDescription || 'Authentication failed');
          }
          return;
        }

        // Handle password recovery redirect
        if (type === 'recovery' && accessToken) {
          navigate('/auth/reset-password', { replace: true });
          return;
        }

        // Get session to verify authentication
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (session) {
          // Verify the user
          const { data: { user }, error: userError } = await supabase.auth.getUser();

          if (userError || !user) {
            throw new Error('Failed to verify user');
          }

          setAuthenticated(true);
          completeOnboarding();
          setState('success');

          // Redirect to home after brief success message
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 1500);
        } else {
          // No session - might be email confirmation without auto-login
          setState('success');
          setTimeout(() => {
            navigate('/auth', { replace: true });
          }, 2000);
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setErrorMessage(err instanceof Error ? err.message : 'Authentication failed');
        setState('error');
      }
    };

    handleCallback();
  }, [navigate, setAuthenticated, completeOnboarding]);

  return (
    <div data-ev-id="ev_d87468b254" className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center">

        <Logo size="lg" className="mx-auto mb-8" />

        {state === 'processing' &&
        <div data-ev-id="ev_beb33f83af" className="flex flex-col items-center gap-4">
            <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>

              <Loader2 className="w-8 h-8 text-primary" />
            </motion.div>
            <p data-ev-id="ev_09f9d6fecd" className="text-foreground-secondary font-light">Verifying your account...</p>
          </div>
        }

        {state === 'success' &&
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-4">

            <div data-ev-id="ev_5540bbb047" className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <div data-ev-id="ev_899c3b2aff">
              <h1 data-ev-id="ev_3ec861758f" className="text-xl font-display font-light text-foreground mb-1">
                Email Verified
              </h1>
              <p data-ev-id="ev_357bdc9e2f" className="text-foreground-secondary text-sm">Redirecting you now...</p>
            </div>
          </motion.div>
        }

        {(state === 'error' || state === 'expired') &&
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-4">

            <div data-ev-id="ev_fac1d7072b" className="w-16 h-16 rounded-full bg-error/20 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-error" />
            </div>
            <div data-ev-id="ev_30e0b947fa">
              <h1 data-ev-id="ev_edf2d9223a" className="text-xl font-display font-light text-foreground mb-1">
                {state === 'expired' ? 'Link Expired' : 'Verification Failed'}
              </h1>
              <p data-ev-id="ev_e2eb7c35ca" className="text-foreground-secondary text-sm mb-4">{errorMessage}</p>
              <button data-ev-id="ev_cba8abd6b1"
            onClick={() => navigate('/auth', { replace: true })}
            className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-[var(--radius-md)] hover:bg-primary-hover transition-colors">

                Back to Sign In
              </button>
            </div>
          </motion.div>
        }
      </motion.div>
    </div>);

}