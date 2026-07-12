/**
 * SAVR Profile Page
 * User profile with real data and settings navigation
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  User,
  Package,
  LogOut,
  ChevronRight,
  Moon,
  Bell,
  Shield,
  HelpCircle,
  Info,
  MapPin,
  Heart,
  Download,
  Trash2,
  FileText,
  ChefHat,
  Dog,
  Cat,
  Loader2,
  CreditCard } from
'lucide-react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/brand/Logo';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/store/app-store';

type SettingsSection = {
  section: string;
  items: {
    id: string;
    label: string;
    icon: React.ComponentType<{className?: string;strokeWidth?: number;}>;
    desc: string;
    route?: string;
    action?: () => void;
    destructive?: boolean;
  }[];
};

const modeIcons = {
  human: ChefHat,
  dog: Dog,
  cat: Cat
};

const modeLabels = {
  human: 'Human Recipes',
  dog: 'Dog-Safe Recipes',
  cat: 'Cat-Safe Recipes'
};

export default function Profile() {
  const navigate = useNavigate();
  const {
    recipes,
    inventory,
    mealPlans,
    preferences,
    isAuthenticated,
    resetStore,
    setAuthenticated
  } = useAppStore();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Compute stats from real data
  const stats = useMemo(() => ({
    recipeCount: recipes.length,
    inventoryCount: inventory.length,
    planCount: mealPlans.filter((p) => {
      const planDate = new Date(p.date);
      const today = new Date();
      return planDate >= today;
    }).length,
    favoriteCount: recipes.filter((r) => r.isFavorite).length
  }), [recipes, inventory, mealPlans]);

  const ModeIcon = modeIcons[preferences.recipeMode];

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      setAuthenticated(false);
      navigate('/auth');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleDeleteData = () => {
    resetStore();
    setShowDeleteConfirm(false);
    navigate('/onboarding');
  };

  const handleExportData = () => {
    const data = {
      recipes,
      inventory,
      mealPlans,
      preferences,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `savr-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const menuItems: SettingsSection[] = [
  {
    section: 'Preferences',
    items: [
    { id: 'storage', label: 'Storage Locations', icon: MapPin, desc: 'Manage where you store food', route: '/settings' },
    { id: 'mode', label: 'Recipe Mode', icon: ModeIcon, desc: modeLabels[preferences.recipeMode], route: '/settings' },
    { id: 'dietary', label: 'Dietary Preferences', icon: Heart, desc: `${preferences.diets.length} preferences set`, route: '/settings' },
    { id: 'notifications', label: 'Notifications', icon: Bell, desc: 'Manage alerts', route: '/settings' },
    { id: 'appearance', label: 'Appearance', icon: Moon, desc: 'Dark mode', route: '/settings' }]

  },
  {
    section: 'Account',
    items: [
    { id: 'security', label: 'Security', icon: Shield, desc: 'Password & security', route: '/settings' },
    {
      id: 'subscription',
      label: 'Subscription',
      icon: CreditCard,
      desc: isAuthenticated ? 'Manage plan' : 'Guest mode',
      route: '/settings'
    }]

  },
  {
    section: 'Data',
    items: [
    { id: 'export', label: 'Export Data', icon: Download, desc: 'Download your data', action: handleExportData },
    { id: 'privacy', label: 'Privacy & Consent', icon: FileText, desc: 'Data preferences', route: '/settings' },
    {
      id: 'delete',
      label: 'Delete All Data',
      icon: Trash2,
      desc: 'Permanently remove data',
      action: () => setShowDeleteConfirm(true),
      destructive: true
    }]

  },
  {
    section: 'Support',
    items: [
    { id: 'help', label: 'Help Center', icon: HelpCircle, desc: 'FAQ & tutorials', route: '/settings' },
    { id: 'about', label: 'About SAVR', icon: Info, desc: 'Version 1.0.0', route: '/settings' }]

  }];


  return (
    <MobileLayout title="Profile">
      <div data-ev-id="ev_300b3b9945" className="flex flex-col gap-6 px-5 py-6">
        {/* User card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card variant="bordered" padding="lg" glowOnHover>
            <div data-ev-id="ev_47e18ba191" className="flex items-center gap-5">
              <div data-ev-id="ev_5831ef90bc" className="w-18 h-18 border border-primary/30 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" strokeWidth={1} />
              </div>
              <div data-ev-id="ev_d956919661" className="flex-1">
                <h2 data-ev-id="ev_1586d92a54" className="font-display text-xl font-light text-foreground">
                  {preferences.displayName || 'SAVR User'}
                </h2>
                <p data-ev-id="ev_fb9bf33b60" className="text-foreground-muted text-sm font-light">
                  {isAuthenticated ? 'Account' : 'Guest Mode'}
                </p>
                {!isAuthenticated &&
                <p data-ev-id="ev_1bf18474c4" className="text-xs text-warning mt-1">
                    Sign in to sync your data across devices
                  </p>
                }
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Stats - Real data only */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}>

          <div data-ev-id="ev_a14779ec7c" className="grid grid-cols-3 gap-px bg-border rounded-[var(--radius-md)] overflow-hidden">
            <div data-ev-id="ev_b0490b3103" className="bg-surface p-4 text-center">
              <p data-ev-id="ev_8d8c882bcb" className="text-xl font-display font-light text-foreground">
                {stats.recipeCount}
              </p>
              <p data-ev-id="ev_3d847b6691" className="text-[10px] text-foreground-muted font-mono tracking-[0.15em] uppercase mt-1">
                Recipes
              </p>
            </div>
            <div data-ev-id="ev_eae1e4a68c" className="bg-surface p-4 text-center">
              <p data-ev-id="ev_4dbf52886f" className="text-xl font-display font-light text-foreground">
                {stats.inventoryCount}
              </p>
              <p data-ev-id="ev_c8653832fc" className="text-[10px] text-foreground-muted font-mono tracking-[0.15em] uppercase mt-1">
                Items
              </p>
            </div>
            <div data-ev-id="ev_6c8ae81bad" className="bg-surface p-4 text-center">
              <p data-ev-id="ev_599ccb603d" className="text-xl font-display font-light text-primary">
                {stats.favoriteCount}
              </p>
              <p data-ev-id="ev_25f0712ff6" className="text-[10px] text-foreground-muted font-mono tracking-[0.15em] uppercase mt-1">
                Favorites
              </p>
            </div>
          </div>
        </motion.div>

        {/* Guest mode CTA */}
        {!isAuthenticated &&
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}>

            <Card className="bg-primary/5 border border-primary/20">
              <div data-ev-id="ev_607c179893" className="flex items-center gap-4">
                <div data-ev-id="ev_e2a0cd6db3" className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div data-ev-id="ev_a9f0278617" className="flex-1">
                  <p data-ev-id="ev_deb2044190" className="font-medium text-foreground">Create an account</p>
                  <p data-ev-id="ev_56c4db170f" className="text-sm text-foreground-secondary">
                    Sync your recipes and inventory across devices
                  </p>
                </div>
                <Button size="sm" onClick={() => navigate('/auth')}>
                  Sign Up
                </Button>
              </div>
            </Card>
          </motion.div>
        }

        {/* Menu sections */}
        {menuItems.map(({ section, items }, sectionIdx) =>
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 + sectionIdx * 0.05 }}>

            <div data-ev-id="ev_09d022ec74" className="flex items-center gap-3 mb-3">
              <h3 data-ev-id="ev_0d639e90c3" className="font-mono text-[10px] text-foreground-muted tracking-[0.2em] uppercase">
                {section}
              </h3>
              <div data-ev-id="ev_2d191bbad6" className="flex-1 h-px bg-border" />
            </div>
            <div data-ev-id="ev_172497d79e" className="flex flex-col gap-2">
              {items.map(({ id, label, icon: Icon, desc, route, action, destructive }) =>
            <Card
              key={id}
              variant="interactive"
              padding="sm"
              glowOnHover={!destructive}
              className={`cursor-pointer ${destructive ? 'hover:border-error/30' : ''}`}
              onClick={() => {
                if (action) action();else
                if (route) navigate(route);
              }}>

                  <div data-ev-id="ev_02ee804745" className="flex items-center gap-4">
                    <div data-ev-id="ev_d9ce542a9c"
                className={`w-10 h-10 border flex items-center justify-center ${
                destructive ? 'border-error/30' : 'border-border'}`
                }>

                      <Icon
                    className={`w-5 h-5 ${destructive ? 'text-error' : 'text-foreground-muted'}`}
                    strokeWidth={1.5} />

                    </div>
                    <div data-ev-id="ev_973045419e" className="flex-1">
                      <p data-ev-id="ev_12eef0b08f" className={`font-light ${destructive ? 'text-error' : 'text-foreground'}`}>
                        {label}
                      </p>
                      <p data-ev-id="ev_6ff035756a" className="text-xs text-foreground-muted font-mono tracking-wider mt-0.5">
                        {desc}
                      </p>
                    </div>
                    {!action && <ChevronRight className="w-4 h-4 text-foreground-muted" strokeWidth={1.5} />}
                  </div>
                </Card>
            )}
            </div>
          </motion.div>
        )}

        {/* Logout */}
        {isAuthenticated &&
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}>

            <Button
            variant="ghost"
            fullWidth
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="text-foreground-muted hover:text-error">

              {isLoggingOut ?
            <Loader2 className="w-4 h-4 animate-spin" /> :

            <LogOut className="w-4 h-4" />
            }
              Sign Out
            </Button>
          </motion.div>
        }

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col items-center gap-3 pt-4">

          <Logo size="sm" />
          <p data-ev-id="ev_d271c43436" className="text-[10px] text-foreground-muted font-mono tracking-[0.2em]">
            SAVR · VERSION 1.0.0
          </p>
        </motion.div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm &&
      <div data-ev-id="ev_e03c52d6ba" className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center p-6">
          <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-surface border border-border rounded-[var(--radius-lg)] p-6 max-w-sm w-full">

            <div data-ev-id="ev_1530cc23a9" className="w-12 h-12 rounded-full bg-error/20 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-error" />
            </div>
            <h3 data-ev-id="ev_8e1589819a" className="text-lg font-display text-foreground text-center mb-2">
              Delete All Data?
            </h3>
            <p data-ev-id="ev_cf6b51c719" className="text-sm text-foreground-secondary text-center mb-6">
              This will permanently delete all your recipes, inventory, and meal plans. This action
              cannot be undone.
            </p>
            <div data-ev-id="ev_5186018694" className="flex gap-3">
              <Button
              variant="outline"
              fullWidth
              onClick={() => setShowDeleteConfirm(false)}>

                Cancel
              </Button>
              <Button variant="danger" fullWidth onClick={handleDeleteData}>
                Delete
              </Button>
            </div>
          </motion.div>
        </div>
      }
    </MobileLayout>);

}