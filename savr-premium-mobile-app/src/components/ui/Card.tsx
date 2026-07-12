/**
 * SAVR Card Component - Prestigious Editorial
 * Laser-thin borders, obsidian surfaces, precision layout
 * IMPROVED: Better contrast
 */

import { HTMLAttributes, ReactNode, useState } from 'react';
import { motion } from 'motion/react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'ghost' | 'elevated' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
  glowOnHover?: boolean;
}

const variants = {
  default: 'bg-surface border border-border',
  bordered: 'bg-surface border border-border-strong',
  ghost: 'bg-transparent border border-border',
  elevated: 'bg-surface-raised border border-border-strong shadow-lg',
  interactive: 'bg-surface border border-border hover:border-primary/60 transition-all duration-200'
};

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6'
};

export function Card({
  variant = 'default',
  padding = 'md',
  className = '',
  children,
  glowOnHover = false,
  ...props
}: CardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      animate={{
        boxShadow: glowOnHover && isHovered ?
        '0 0 30px rgba(255, 184, 0, 0.2)' :
        '0 0 0px rgba(255, 184, 0, 0)'
      }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={`
        ${variants[variant]}
        ${paddings[padding]}
        ${className}
      `}
      {...props}>

      {children}
    </motion.div>);

}

export function CardHeader({ className = '', children }: {className?: string;children: ReactNode;}) {
  return (
    <div data-ev-id="ev_a86dc3b83b" className={`border-b border-border pb-4 mb-4 ${className}`}>
      {children}
    </div>);

}

export function CardTitle({ className = '', children }: {className?: string;children: ReactNode;}) {
  return (
    <h3 data-ev-id="ev_41fe300078" className={`font-display text-xl font-light text-foreground tracking-wide ${className}`}>
      {children}
    </h3>);

}

export function CardDescription({ className = '', children }: {className?: string;children: ReactNode;}) {
  return (
    <p data-ev-id="ev_2be71397cb" className={`text-base text-foreground-secondary ${className}`}>
      {children}
    </p>);

}