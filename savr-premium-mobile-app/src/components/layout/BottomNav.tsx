/**
 * SAVR Bottom Navigation
 * Primary tabs: Home, Pantry, Scan (center), Recipes, Plan
 * Scan is the visually dominant center destination
 */

import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Home, Package, Camera, BookOpen, Calendar } from 'lucide-react';
import { useState } from 'react';
import { Scanner } from '@/components/scanner/Scanner';

interface NavTab {
  id: string;
  label: string;
  icon: typeof Home;
  path: string | null;
  isCenter?: boolean;
}

const tabs: NavTab[] = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'pantry', label: 'Pantry', icon: Package, path: '/pantry' },
  { id: 'scan', label: 'Scan', icon: Camera, path: null, isCenter: true },
  { id: 'recipes', label: 'Recipes', icon: BookOpen, path: '/recipes' },
  { id: 'plan', label: 'Plan', icon: Calendar, path: '/plans' },
];


export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showScanner, setShowScanner] = useState(false);

  const handleTabPress = (tab: NavTab) => {
    if (tab.id === 'scan') {
      setShowScanner(true);
    } else if (tab.path) {
      navigate(tab.path);
    }
  };

  return (
    <>
      <nav data-ev-id="ev_549c2d6389"
      className="
          fixed bottom-0 left-0 right-0 z-30
          bg-surface/95 backdrop-blur-xl
          border-t border-border
          pb-safe
        "





      role="navigation"
      aria-label="Main navigation">

        <div data-ev-id="ev_4e8f60b64e" className="h-[var(--spacing-nav-height)] flex items-stretch">
          {tabs.map(({ id, label, icon: Icon, path, isCenter }) => {
            const isActive = path ?
            location.pathname === path ||
            path !== '/' && location.pathname.startsWith(path) :
            false;

            // Center scan button - prominent
            if (isCenter) {
              return (
                <button data-ev-id="ev_f3472a73bb"
                key={id}
                onClick={() => handleTabPress({ id, label, icon: Icon, path, isCenter })}
                className="
                    flex-1 flex flex-col items-center justify-center gap-1
                    relative -mt-4
                  "



                aria-label="Scan ingredients">

                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="
                      w-14 h-14 rounded-full
                      bg-primary text-primary-foreground
                      flex items-center justify-center
                      shadow-lg shadow-primary/30
                    ">






                    <Icon className="w-6 h-6" strokeWidth={2} />
                  </motion.div>
                  <span data-ev-id="ev_c92ab65e9b" className="text-[11px] font-medium tracking-wide text-foreground-secondary">
                    {label}
                  </span>
                </button>);

            }

            return (
              <button data-ev-id="ev_b5480f37e2"
              key={id}
              onClick={() => handleTabPress({ id, label, icon: Icon, path, isCenter })}
              className={`
                  flex-1 flex flex-col items-center justify-center gap-1.5
                  transition-colors duration-150 relative
                  min-h-[44px] min-w-[44px]
                  ${isActive ? 'text-primary' : 'text-foreground-muted'}
                `}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}>

                {/* Active indicator */}
                {isActive &&
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }} />

                }
                
                <Icon
                  className="w-5 h-5"
                  strokeWidth={isActive ? 2 : 1.5} />

                <span data-ev-id="ev_88b5c273a6" className="text-[11px] font-medium tracking-wide">
                  {label}
                </span>
              </button>);

          })}
        </div>
      </nav>

      <Scanner isOpen={showScanner} onClose={() => setShowScanner(false)} />
    </>);

}