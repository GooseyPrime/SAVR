/**
 * Password Reset Page
 * Allows users to set a new password after clicking reset link
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type ResetState = 'validating' | 'ready' | 'submitting' | 'success' | 'error' | 'expired';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [state, setState] = useState<ResetState>('validating');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const validateSession = async () => {
      if (!supabase) {
        setError('Database connection unavailable');
        setState('error');
        return;
      }

      // Check hash params for errors
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const errorCode = hashParams.get('error_code');
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');

      if (errorCode) {
        setError('This password reset link has expired. Please request a new one.');
        setState('expired');
        return;
      }

      // Check for valid recovery session
      if (accessToken && type === 'recovery') {
        setState('ready');
        return;
      }

      // Try to get existing session
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setState('ready');
      } else {
        setError('Invalid or expired password reset link');
        setState('expired');
      }
    };

    validateSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!supabase) {
      setError('Database connection unavailable');
      return;
    }

    // Validation
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setState('submitting');

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        throw updateError;
      }

      setState('success');

      // Redirect to home after success
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 2000);
    } catch (err) {
      console.error('Password update error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update password');
      setState('ready');
    }
  };

  // Validating state
  if (state === 'validating') {
    return (
      <div data-ev-id="ev_dbb9efa62d" className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Logo size="lg" className="mb-8" />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>

          <Loader2 className="w-8 h-8 text-primary" />
        </motion.div>
        <p data-ev-id="ev_14714bca33" className="text-foreground-secondary mt-4">Validating reset link...</p>
      </div>);

  }

  // Error/Expired state
  if (state === 'expired' || state === 'error' && !password) {
    return (
      <div data-ev-id="ev_30cc40f044" className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm text-center">

          <Logo size="lg" className="mx-auto mb-8" />
          
          <div data-ev-id="ev_01a80fb859" className="w-16 h-16 rounded-full bg-error/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-error" />
          </div>
          
          <h1 data-ev-id="ev_804baf0091" className="text-xl font-display font-light text-foreground mb-2">
            {state === 'expired' ? 'Link Expired' : 'Invalid Link'}
          </h1>
          <p data-ev-id="ev_063724a851" className="text-foreground-secondary text-sm mb-6">{error}</p>
          
          <Button onClick={() => navigate('/auth', { replace: true })} fullWidth>
            Back to Sign In
          </Button>
        </motion.div>
      </div>);

  }

  // Success state
  if (state === 'success') {
    return (
      <div data-ev-id="ev_7efd0bc2d7" className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm text-center">

          <div data-ev-id="ev_ea36efeef6" className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h1 data-ev-id="ev_2999e18504" className="text-xl font-display font-light text-foreground mb-2">
            Password Updated
          </h1>
          <p data-ev-id="ev_9fedef06fa" className="text-foreground-secondary text-sm">Redirecting you to the app...</p>
        </motion.div>
      </div>);

  }

  // Ready/Submitting state - show form
  return (
    <div data-ev-id="ev_497c6ad6ce" className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm">

        <Logo size="lg" className="mx-auto mb-8" />

        <div data-ev-id="ev_a30c4a0509" className="text-center mb-8">
          <h1 data-ev-id="ev_a466fcdada" className="text-2xl font-display font-light text-foreground mb-2">
            Set New Password
          </h1>
          <p data-ev-id="ev_1999fa8878" className="text-foreground-secondary text-sm">
            Enter your new password below
          </p>
        </div>

        <form data-ev-id="ev_45f70a4b15" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div data-ev-id="ev_e331ff50ab" className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-11 pr-11"
              minLength={8}
              required
              disabled={state === 'submitting'}
              aria-label="New password" />

            <button data-ev-id="ev_227641157a"
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}>

              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <div data-ev-id="ev_e1fc3b28be" className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-11"
              minLength={8}
              required
              disabled={state === 'submitting'}
              aria-label="Confirm new password" />

          </div>

          {error &&
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-error text-sm text-center"
            role="alert">

              {error}
            </motion.p>
          }

          <Button type="submit" fullWidth disabled={state === 'submitting'}>
            {state === 'submitting' ?
            <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating...
              </> :

            'Update Password'
            }
          </Button>
        </form>

        <p data-ev-id="ev_a1e65f66c3" className="text-center text-foreground-muted text-xs mt-6">
          Password must be at least 8 characters
        </p>
      </motion.div>
    </div>);

}