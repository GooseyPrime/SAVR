/**
 * SAVR Button Component
 * Accessible buttons with lime primary color
 */

import { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion } from 'motion/react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary: `
    bg-primary text-primary-foreground font-medium
    border border-primary
    hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/25
    active:bg-primary
  `,
  secondary: `
    bg-surface text-foreground font-medium
    border border-border-strong
    hover:border-primary hover:text-primary hover:shadow-lg hover:shadow-primary/15
    active:bg-surface-raised
  `,
  outline: `
    bg-transparent text-foreground-secondary font-normal
    border border-border-strong
    hover:border-foreground-secondary hover:text-foreground
    active:bg-surface/30
  `,
  ghost: `
    bg-transparent text-foreground-secondary font-normal
    border border-transparent
    hover:text-primary
    active:text-primary-hover
  `,
  danger: `
    bg-transparent text-error font-medium
    border border-error/40
    hover:bg-error/15 hover:border-error
    active:bg-error/25
  `,
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] h-9 px-4 text-sm tracking-wide',
  md: 'min-h-[44px] h-11 px-5 text-sm tracking-wide',
  lg: 'min-h-[44px] h-12 px-8 text-base tracking-wide',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      whileTap={{ scale: disabled ? 1 : 0.99 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className={`
        inline-flex items-center justify-center gap-2
        transition-all duration-200 ease-out
        disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none
        font-sans uppercase
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  );
}
