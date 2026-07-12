/**
 * SAVR Input Component - Prestigious Editorial
 * Whisper-thin borders, clinical precision
 * IMPROVED: Better contrast, larger text
 */

import { InputHTMLAttributes, forwardRef, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className = '', ...props }, ref) => {
    return (
      <div data-ev-id="ev_ba13d718a0" className="flex flex-col gap-2">
        {label &&
        <label data-ev-id="ev_0b749d36c9" className="text-sm font-mono text-foreground-secondary uppercase tracking-[0.12em]">
            {label}
          </label>
        }
        <div data-ev-id="ev_bb05f5b0cc" className="relative group">
          {leftIcon &&
          <div data-ev-id="ev_77e5f44650" className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted group-focus-within:text-primary transition-colors">
              {leftIcon}
            </div>
          }
          <input data-ev-id="ev_4a58530cf4"
          ref={ref}
          className={`
              w-full h-12 px-4 bg-surface border border-border
              text-foreground text-base placeholder:text-foreground-muted
              tracking-wide
              transition-all duration-200 ease-out
              hover:border-border-strong
              focus:outline-none focus:border-primary focus:shadow-[0_0_20px_rgba(255,184,0,0.15)]
              disabled:opacity-40 disabled:cursor-not-allowed
              ${leftIcon ? 'pl-12' : ''}
              ${rightIcon ? 'pr-12' : ''}
              ${error ? 'border-error focus:border-error focus:shadow-[0_0_20px_rgba(248,113,113,0.15)]' : ''}
              ${className}
            `}
          {...props} />

          {rightIcon &&
          <div data-ev-id="ev_bb3b074b6e" className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground-muted">
              {rightIcon}
            </div>
          }
          {/* Sticklight border trace effect */}
          <div data-ev-id="ev_80d4547e36" className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div data-ev-id="ev_20893b9ee1" className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          </div>
        </div>
        {error &&
        <p data-ev-id="ev_304b55d099" className="text-sm text-error font-mono tracking-wide">{error}</p>
        }
        {hint && !error &&
        <p data-ev-id="ev_a10aa33edd" className="text-sm text-foreground-muted font-mono tracking-wide">{hint}</p>
        }
      </div>);

  }
);

Input.displayName = 'Input';