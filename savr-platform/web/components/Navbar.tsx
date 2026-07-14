'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';

const publicLinks = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
];

const appPrimaryLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/inventory', label: 'Pantry' },
  { href: '/recipes', label: 'Recipes' },
  { href: '/meal-plans', label: 'Plans' },
  { href: '/grocery-lists', label: 'Lists' },
] as const;

const appUtilityLinks = [
  { href: '/upload', label: 'Scan Upload' },
  { href: '/chat', label: 'AI Chef' },
  { href: '/preferences', label: 'Preferences' },
  { href: '/settings', label: 'Settings' },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === '/') {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function MenuIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
    </svg>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      setMenuOpen(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const navLinkClass = (href: string) => {
    const active = isActivePath(pathname, href);

    return [
      'rounded-full px-3 py-2 text-sm font-medium transition-all duration-200',
      active
        ? 'text-[var(--color-primary-foreground)] shadow-[var(--shadow-glow)]'
        : 'text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] hover:bg-white/5',
    ].join(' ');
  };

  const secondaryLinkClass = (href: string) => {
    const active = isActivePath(pathname, href);

    return [
      'flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-all duration-200',
      active
        ? 'text-[var(--color-primary)] border-[var(--color-border-strong)] bg-[var(--color-primary-light)]'
        : 'text-[var(--color-foreground-secondary)] border-transparent bg-white/3 hover:border-[var(--color-border)] hover:bg-white/5',
    ].join(' ');
  };

  return (
    <nav
      className="fixed inset-x-0 top-0 z-50 border-b"
      style={{
        background: 'rgba(13, 18, 16, 0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[72px] items-center justify-between gap-4">
          <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[rgba(20,26,23,0.88)]">
              <Image
                src="https://res.cloudinary.com/dksj2niho/image/upload/w_64,h_64,c_fit,q_auto,f_auto/v1770328403/SAVR_Logo_NO_BG_3_hixen3.png"
                alt="SAVR"
                width={32}
                height={32}
                className="h-8 w-8"
                unoptimized
              />
            </div>
            <div className="hidden sm:block">
              <p className="font-[var(--font-display)] text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-foreground-secondary)]">
                SAVR
              </p>
              <p className="text-xs text-[var(--color-foreground-muted)]">
                Production workspace
              </p>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[rgba(20,26,23,0.88)] p-1">
            {(user ? appPrimaryLinks : publicLinks).map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={navLinkClass(href)}
                style={
                  isActivePath(pathname, href)
                    ? {
                        background: 'var(--color-primary)',
                      }
                    : undefined
                }
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            {user ? (
              <>
                <Link href="/upload" className="btn-primary !px-5 !py-2.5 text-sm">
                  Scan Upload
                </Link>
                <button
                  onClick={() => setMenuOpen((open) => !open)}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[rgba(20,26,23,0.92)] px-4 py-2 text-sm font-medium text-[var(--color-foreground-secondary)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-foreground)]"
                  aria-expanded={menuOpen}
                  aria-controls="savr-nav-menu"
                >
                  <span className="max-w-32 truncate">{user.email}</span>
                  {menuOpen ? <CloseIcon /> : <MenuIcon />}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="text-sm font-medium text-[var(--color-foreground-secondary)] transition hover:text-[var(--color-foreground)]"
                >
                  Sign In
                </Link>
                <Link href="/sign-up" className="btn-primary text-sm !px-5 !py-2.5">
                  Get Started
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[rgba(20,26,23,0.92)] text-[var(--color-foreground-secondary)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-foreground)] lg:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            aria-controls="savr-nav-menu"
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          id="savr-nav-menu"
          className="border-t overflow-y-auto"
          style={{
            background: 'rgba(13, 18, 16, 0.96)',
            borderColor: 'var(--color-border)',
            maxHeight: 'calc(100vh - 72px)',
          }}
        >
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            {user ? (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-foreground-muted)]">
                    Primary navigation
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {appPrimaryLinks.map(({ href, label }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMenuOpen(false)}
                        className={secondaryLinkClass(href)}
                      >
                        <span>{label}</span>
                        <ChevronRightIcon />
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-foreground-muted)]">
                    Workspace
                  </p>
                  <div className="grid gap-2">
                    {appUtilityLinks.map(({ href, label }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMenuOpen(false)}
                        className={secondaryLinkClass(href)}
                      >
                        <span>{label}</span>
                        <ChevronRightIcon />
                      </Link>
                    ))}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center justify-between rounded-2xl border border-[var(--color-error-light)] bg-[rgba(255,107,107,0.08)] px-4 py-3 text-sm font-medium text-[var(--color-error)] transition hover:bg-[rgba(255,107,107,0.12)]"
                  >
                    <span>Logout</span>
                    <ChevronRightIcon />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {publicLinks.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className={secondaryLinkClass(href)}
                  >
                    <span>{label}</span>
                    <ChevronRightIcon />
                  </Link>
                ))}
                <Link href="/sign-in" onClick={() => setMenuOpen(false)} className={secondaryLinkClass('/sign-in')}>
                  <span>Sign In</span>
                  <ChevronRightIcon />
                </Link>
                <Link href="/sign-up" onClick={() => setMenuOpen(false)} className="btn-primary flex justify-center text-sm">
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
