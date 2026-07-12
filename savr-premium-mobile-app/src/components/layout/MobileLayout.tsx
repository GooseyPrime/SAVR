/**
 * SAVR Mobile Layout
 * Core layout wrapper with header, content area, and bottom navigation
 */

import { ReactNode } from 'react';
import { Header } from './Header';
import { BottomNav } from './BottomNav';

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  showHeader?: boolean;
  showNav?: boolean;
  showProfile?: boolean;
  showLogo?: boolean;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  showModeToggle?: boolean;
}

export function MobileLayout({
  children,
  title,
  showHeader = true,
  showNav = true,
  showProfile = true,
  showLogo = false,
  headerLeft,
  headerRight,
  showModeToggle = false
}: MobileLayoutProps) {
  return (
    <div data-ev-id="ev_905918759d" className="min-h-screen bg-background flex flex-col">
      {/* Safe area top */}
      <div data-ev-id="ev_3b695d6a8a" className="pt-safe bg-background" />
      
      {/* Header */}
      {showHeader &&
      <Header
        title={title}
        left={headerLeft}
        right={headerRight}
        showLogo={showLogo}
        showProfile={showProfile}
        showModeToggle={showModeToggle} />

      }
      
      {/* Main content */}
      <main data-ev-id="ev_e0c052efad"
      className={`
          flex-1 overflow-y-auto
          ${showNav ? 'pb-[calc(var(--spacing-nav-height)+var(--spacing-safe-bottom))]' : 'pb-safe'}
        `}>

        {children}
      </main>
      
      {/* Bottom Nav */}
      {showNav && <BottomNav />}
    </div>);

}