/**
 * SAVR Auth Page
 * Authentication with sign in, sign up, and forgot password
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Mail, Lock, User, ArrowLeft, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Logo } from '@/components/brand/Logo';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/store/app-store';

type AuthMode = 'login' | 'signup' | 'forgot';

export default function Auth() {
  const navigate = useNavigate();
  const { completeOnboarding, setAuthenticated } = useAppStore();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Database not connected. You can continue as a guest.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name },
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        });
        if (error) throw error;
        setSuccess('Check your email to confirm your account.');
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setAuthenticated(true);
        completeOnboarding();
        navigate('/');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`
        });
        if (error) throw error;
        setSuccess('Password reset link sent to your email.');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        // More user-friendly error messages
        if (err.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.');
        } else if (err.message.includes('Email not confirmed')) {
          setError('Please check your email and confirm your account.');
        } else {
          setError(err.message);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const continueAsGuest = () => {
    completeOnboarding();
    navigate('/');
  };

  return (
    <div data-ev-id="ev_574bd54440" className="min-h-screen bg-background flex flex-col relative">
      {/* Ambient glow */}
      <div data-ev-id="ev_594c865f74" className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}
      <div data-ev-id="ev_8cb8be1554" className="pt-safe relative z-10">
        <div data-ev-id="ev_f61a6aca8f" className="flex items-center justify-between p-4">
          {mode !== 'login' ?
          <button data-ev-id="ev_66b8fce800"
          onClick={() => setMode('login')}
          className="p-2 text-foreground-muted hover:text-foreground transition-colors"
          aria-label="Back to sign in">

              <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
            </button> :

          <div data-ev-id="ev_4094e0b7b3" className="w-9" />
          }
          <div data-ev-id="ev_ef6fa12ea0" className="w-9" />
        </div>
      </div>

      {/* Content */}
      <div data-ev-id="ev_e11cb28c08" className="flex-1 flex flex-col items-center justify-center px-5 pb-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm">

          {/* Logo and title */}
          <div data-ev-id="ev_3353c8f79e" className="flex flex-col items-center mb-8">
            <Logo size="lg" variant="mark" />
            <h1 data-ev-id="ev_ef2da9213c" className="text-2xl font-display font-medium text-foreground mt-6">
              {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create account' : 'Reset password'}
            </h1>
            <p data-ev-id="ev_feaadce1de" className="text-foreground-secondary text-sm mt-2 text-center">
              {mode === 'login' ?
              'Sign in to sync your data across devices' :
              mode === 'signup' ?
              'Join SAVR to save recipes and sync your pantry' :
              'We\'ll send you a reset link'
              }
            </p>
          </div>

          {/* Form */}
          <Card variant="bordered" padding="lg">
            <form data-ev-id="ev_7d4fd934ff" onSubmit={handleSubmit} className="flex flex-col gap-4">
              {mode === 'signup' &&
              <Input
                label="Name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                leftIcon={<User className="w-4 h-4" strokeWidth={1.5} />}
                required />

              }
              
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" strokeWidth={1.5} />}
                required />


              {mode !== 'forgot' &&
              <div data-ev-id="ev_17456e6895" className="relative">
                  <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" strokeWidth={1.5} />}
                  required
                  minLength={6} />

                  <button data-ev-id="ev_3b3e5b07eb"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 p-1 text-foreground-muted hover:text-foreground transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}>

                    {showPassword ?
                  <EyeOff className="w-4 h-4" strokeWidth={1.5} /> :

                  <Eye className="w-4 h-4" strokeWidth={1.5} />
                  }
                  </button>
                </div>
              }

              {/* Error message */}
              {error &&
              <div data-ev-id="ev_545e184d31" className="flex items-start gap-3 p-3 bg-error/10 border border-error/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                  <p data-ev-id="ev_4e07015f12" className="text-sm text-error">{error}</p>
                </div>
              }

              {/* Success message */}
              {success &&
              <div data-ev-id="ev_7059b70b93" className="p-3 bg-success/10 border border-success/20 rounded-lg">
                  <p data-ev-id="ev_19cf12512f" className="text-sm text-success">{success}</p>
                </div>
              }

              <Button type="submit" fullWidth disabled={isLoading} className="mt-2">
                {isLoading ?
                <Loader2 className="w-4 h-4 animate-spin" /> :
                mode === 'login' ?
                'Sign In' :
                mode === 'signup' ?
                'Create Account' :

                'Send Reset Link'
                }
              </Button>
            </form>
          </Card>

          {/* Footer links */}
          <div data-ev-id="ev_32fe59a423" className="mt-6 text-center">
            {mode === 'login' &&
            <>
                <button data-ev-id="ev_3155d5ed3b"
              onClick={() => setMode('forgot')}
              className="text-sm text-foreground-muted hover:text-primary transition-colors">

                  Forgot password?
                </button>
                <div data-ev-id="ev_af83c45c7f" className="mt-4">
                  <span data-ev-id="ev_557bfd77a1" className="text-sm text-foreground-muted">Don't have an account? </span>
                  <button data-ev-id="ev_ec2a771190"
                onClick={() => setMode('signup')}
                className="text-sm text-primary hover:underline">

                    Sign up
                  </button>
                </div>
              </>
            }
            {mode === 'signup' &&
            <div data-ev-id="ev_6653476646">
                <span data-ev-id="ev_7c476ceb01" className="text-sm text-foreground-muted">Already have an account? </span>
                <button data-ev-id="ev_dca1ddb2ee"
              onClick={() => setMode('login')}
              className="text-sm text-primary hover:underline">

                  Sign in
                </button>
              </div>
            }
          </div>

          {/* Guest mode option */}
          <div data-ev-id="ev_a5843f85f7" className="mt-8 pt-6 border-t border-border">
            <button data-ev-id="ev_593b89f55f"
            onClick={continueAsGuest}
            className="w-full text-center text-sm text-foreground-muted hover:text-foreground transition-colors">

              Continue as guest
            </button>
            <p data-ev-id="ev_78ca5edf1c" className="text-xs text-foreground-muted text-center mt-2">
              Guest data is stored locally and won't sync across devices
            </p>
          </div>
        </motion.div>
      </div>
    </div>);

}