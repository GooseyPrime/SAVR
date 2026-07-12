/**
 * SAVR Logo Component - Prestigious Editorial
 * Using official brand logo with amber-gold accents
 * INCREASED SIZES for better visibility
 */

import { motion } from 'motion/react';

const LOGO_URL = 'https://res.cloudinary.com/intellme/image/upload/v1770466761/SAVR_Logo_NO_BG_3_hixen3.png';

interface LogoProps {
  variant?: 'default' | 'mark' | 'full';
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

const sizes = {
  sm: { container: 'w-10 h-10', text: 'text-xs' },
  md: { container: 'w-14 h-14', text: 'text-sm' },
  lg: { container: 'w-20 h-20', text: 'text-base' },
  xl: { container: 'w-24 h-24', text: 'text-lg' },
  '2xl': { container: 'w-32 h-32', text: 'text-xl' }
};

export function Logo({ variant = 'default', size = 'md', className = '' }: LogoProps) {
  const sizeConfig = sizes[size];

  if (variant === 'full') {
    return (
      <div data-ev-id="ev_915926a297" className={`flex items-center gap-4 ${className}`}>
        <div data-ev-id="ev_1d27fa67a1" className={sizeConfig.container}>
          <img data-ev-id="ev_8c9cc08593"
          src={LOGO_URL}
          alt="SAVR"
          className="w-full h-full object-contain" />

        </div>
        <span data-ev-id="ev_8c022fc4a7" className={`font-display font-light tracking-[0.3em] text-foreground uppercase ${sizeConfig.text}`}>
          SAVR
        </span>
      </div>);

  }

  if (variant === 'mark') {
    return (
      <div data-ev-id="ev_117e0f8e2a" className={`${sizeConfig.container} ${className}`}>
        <img data-ev-id="ev_9f12e35a8e"
        src={LOGO_URL}
        alt="SAVR"
        className="w-full h-full object-contain" />

      </div>);

  }

  // Default - mark with subtle border
  return (
    <div data-ev-id="ev_43c47142a1" className={`${sizeConfig.container} ${className} relative`}>
      <div data-ev-id="ev_f2ba4c6e9b" className="w-full h-full border border-border flex items-center justify-center p-2">
        <img data-ev-id="ev_d989655149"
        src={LOGO_URL}
        alt="SAVR"
        className="w-full h-full object-contain" />

      </div>
    </div>);

}

export function LogoAnimated({ className = '' }: {className?: string;}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`relative ${className}`}>

      {/* Ambient glow */}
      <motion.div
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0 bg-primary/20 blur-3xl scale-150" />

      
      {/* Logo container with border - LARGER */}
      <div data-ev-id="ev_203eb5dd5a" className="relative w-36 h-36 border border-primary/30 flex items-center justify-center">
        <img data-ev-id="ev_90a3eeee6e"
        src={LOGO_URL}
        alt="SAVR"
        className="w-28 h-28 object-contain" />

        
        {/* Corner accents */}
        <div data-ev-id="ev_2e680b375c" className="absolute -top-px -left-px w-5 h-px bg-primary" />
        <div data-ev-id="ev_062514ebd6" className="absolute -top-px -left-px w-px h-5 bg-primary" />
        <div data-ev-id="ev_3ef6da329d" className="absolute -top-px -right-px w-5 h-px bg-primary" />
        <div data-ev-id="ev_e253ebd69b" className="absolute -top-px -right-px w-px h-5 bg-primary" />
        <div data-ev-id="ev_697f658d42" className="absolute -bottom-px -left-px w-5 h-px bg-primary" />
        <div data-ev-id="ev_c20c2f63f3" className="absolute -bottom-px -left-px w-px h-5 bg-primary" />
        <div data-ev-id="ev_6d782519d9" className="absolute -bottom-px -right-px w-5 h-px bg-primary" />
        <div data-ev-id="ev_c9ab6edc99" className="absolute -bottom-px -right-px w-px h-5 bg-primary" />
      </div>
    </motion.div>);

}

