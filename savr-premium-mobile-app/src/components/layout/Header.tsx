/**
 * SAVR Header Component
 * Clean header with logo, title, and user avatar for profile access
 */

import { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { User } from 'lucide-react';
import { ModeToggle } from '@/components/ui/ModeToggle';
import { Logo } from '@/components/brand/Logo';

interface HeaderProps {
  title?: string;
  left?: ReactNode;
  right?: ReactNode;
  showLogo?: boolean;
  showModeToggle?: boolean;
  showProfile?: boolean;
}

export function Header({
  title,
  left,
  right,
  showLogo = false,
  showModeToggle = false,
  showProfile = true
}: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header data-ev-id="ev_822ef4e76b"
    className="
        sticky top-0 z-20
        h-[var(--spacing-header-height)]
        bg-background/90 backdrop-blur-xl
        border-b border-border
        flex items-center justify-between px-4
      ">







      {/* Left section */}
      <div data-ev-id="ev_1cb0c4653e" className="w-20 flex justify-start items-center gap-3">
        {left}
        {showLogo && !left &&
        <Logo size="sm" variant="mark" />
        }
      </div>
      
      {/* Center title */}
      {title &&
      <h1 data-ev-id="ev_6eab1cc153" className="font-display text-base font-medium text-foreground tracking-wide">
          {title}
        </h1>
      }
      
      {/* Right section */}
      <div data-ev-id="ev_8aa1285dba" className="w-20 flex justify-end items-center gap-2">
        {showModeToggle && <ModeToggle />}
        {right}
        {showProfile && !right &&
        <button data-ev-id="ev_011aa17335"
        onClick={() => navigate('/profile')}
        className="
              w-9 h-9 rounded-full
              bg-surface-raised border border-border
              flex items-center justify-center
              text-foreground-muted hover:text-foreground
              transition-colors duration-150
            "






        aria-label="Profile">

            <User className="w-4 h-4" strokeWidth={1.5} />
          </button>
        }
      </div>
    </header>);

}