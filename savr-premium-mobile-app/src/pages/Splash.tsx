/**
 * SAVR Splash Screen - Prestigious Editorial
 * Elegant entrance with amber-gold accents
 * IMPROVED: Better contrast, larger text
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { LogoAnimated } from '@/components/brand/Logo';

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/onboarding');
    }, 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div data-ev-id="ev_3ea84d22ba" className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ambient light effect */}
      <div data-ev-id="ev_b3c5ea0bbe" className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/8 blur-[120px] rounded-full" />
      
      {/* Precision grid overlay */}
      <div data-ev-id="ev_f2ca31ed8a" className="absolute inset-0 opacity-[0.03]">
        <div data-ev-id="ev_36e26decaa" className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(186,255,92,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(186,255,92,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }} />
      </div>

      {/* Logo */}
      <LogoAnimated />

      {/* Brand text */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="mt-10 text-center">

        <h1 data-ev-id="ev_7436afa234" className="font-display text-5xl font-light text-foreground tracking-[0.2em]">
          SAVR
        </h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="text-foreground-secondary text-lg mt-4 tracking-wide"
          style={{ fontFamily: 'var(--font-script)' }}>

          A study in culinary precision
        </motion.p>
      </motion.div>

      {/* Loading bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-24 left-1/2 -translate-x-1/2 w-32">

        <div data-ev-id="ev_5742c51a51" className="h-px bg-border-strong overflow-hidden">
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="h-full w-1/2 bg-gradient-to-r from-transparent via-primary to-transparent" />

        </div>
      </motion.div>

      {/* Version */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-10 font-mono text-xs text-foreground-secondary tracking-[0.2em]">

        VERSION 2.0
      </motion.p>
    </div>);

}