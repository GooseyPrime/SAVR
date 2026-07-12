/**
 * SAVR Mode Toggle - Prestigious Editorial
 * Refined segmented control with amber-gold indicators
 * IMPROVED: Better contrast, larger touch targets
 */

import { motion } from 'motion/react';
import { ChefHat, Dog, Cat } from 'lucide-react';
import { useAppStore, type RecipeMode } from '@/store/app-store';

const modes: {id: RecipeMode;icon: typeof ChefHat;label: string;}[] = [
{ id: 'human', icon: ChefHat, label: 'Chef' },
{ id: 'dog', icon: Dog, label: 'Canine' },
{ id: 'cat', icon: Cat, label: 'Feline' }];


export function ModeToggle() {
  const { preferences, setRecipeMode } = useAppStore();
  const activeIndex = modes.findIndex((m) => m.id === preferences.recipeMode);

  return (
    <div data-ev-id="ev_d0ee1a85c9" className="relative flex bg-surface border border-border-strong">
      {/* Active indicator */}
      <motion.div
        className="absolute top-0 bottom-0 bg-primary/15 border-b-2 border-primary"
        initial={false}
        animate={{
          left: `${activeIndex * 33.33}%`,
          width: '33.33%'
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }} />

      
      {modes.map(({ id, icon: Icon }) =>
      <button data-ev-id="ev_050547553c"
      key={id}
      onClick={() => setRecipeMode(id)}
      className={`
            relative z-10 flex items-center justify-center w-11 h-10
            transition-colors duration-200
            ${preferences.recipeMode === id ? 'text-primary' : 'text-foreground-secondary hover:text-foreground'}
          `}
      title={id}>

          <Icon className="w-5 h-5" strokeWidth={1.5} />
        </button>
      )}
    </div>);

}