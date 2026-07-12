/**
 * SAVR Recipes Page
 * Recipe collection with search, filters, and generation
 * No sample recipes - only user-saved recipes
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Filter,
  Sparkles,
  BookOpen,
  Clock,
  ChefHat,
  Heart,
  X,
  Plus,
  Dog,
  Cat,
  User } from
'lucide-react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RecipeCard } from '@/components/recipes/RecipeCard';
import { RecipeGenerator } from '@/components/recipes/RecipeGenerator';
import { useAppStore } from '@/store/app-store';

const filters = [
{ id: 'all', label: 'All' },
{ id: 'ai', label: 'AI Generated' },
{ id: 'saved', label: 'Saved' },
{ id: 'quick', label: 'Quick (<30m)' },
{ id: 'favorites', label: 'Favorites' }];


// Mode icons
function getModeIcon(mode: 'human' | 'dog' | 'cat') {
  const icons = { human: User, dog: Dog, cat: Cat };
  return icons[mode];
}

export default function Recipes() {
  const navigate = useNavigate();
  const { recipes, preferences, toggleFavorite } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showGenerator, setShowGenerator] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Filter recipes based on current mode and search/filters
  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      // Mode filter - show recipes for current mode
      if (recipe.mode !== preferences.recipeMode) return false;

      // Search filter
      const matchesSearch = recipe.title.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Type filters
      if (activeFilter === 'ai') return recipe.isAiGenerated;
      if (activeFilter === 'saved') return !recipe.isAiGenerated;
      if (activeFilter === 'quick') return (recipe.prepTime + recipe.cookTime) <= 30;
      if (activeFilter === 'favorites') return recipe.isFavorite;

      return true;
    });
  }, [recipes, preferences.recipeMode, searchQuery, activeFilter]);

  const recipeCount = filteredRecipes.length;
  const ModeIcon = getModeIcon(preferences.recipeMode);

  return (
    <MobileLayout
      title="Recipes"
      headerRight={
      <Button size="sm" onClick={() => setShowGenerator(true)}>
          <Sparkles className="w-4 h-4" />
          Generate
        </Button>
      }>

      <div data-ev-id="ev_ff72d684bd" className="flex flex-col gap-4 px-4 py-4">
        {/* Mode indicator */}
        <div data-ev-id="ev_1d71c66e71" className="flex items-center gap-2 text-sm text-foreground-secondary">
          <ModeIcon className="w-4 h-4" strokeWidth={1.5} />
          <span data-ev-id="ev_e7c8190b1d">
            {preferences.recipeMode === 'human' ? 'Human' :
            preferences.recipeMode === 'dog' ? 'Dog' : 'Cat'} recipes
          </span>
        </div>

        {/* Search and Filter */}
        <div data-ev-id="ev_69d06993c7" className="flex gap-2">
          <div data-ev-id="ev_6ee41d3981" className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <Input
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10" />

            {searchQuery &&
            <button data-ev-id="ev_a373a45dcd"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1">

                <X className="w-4 h-4 text-foreground-muted" />
              </button>
            }
          </div>
          <Button
            variant={showFilters ? 'primary' : 'outline'}
            onClick={() => setShowFilters(!showFilters)}
            className="px-3">

            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {/* Filter chips */}
        <AnimatePresence>
          {showFilters &&
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2 overflow-hidden">

              {filters.map((filter) =>
            <button data-ev-id="ev_3031012dcb"
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`
                    px-3 py-1.5 text-sm rounded-full transition-colors
                    ${activeFilter === filter.id ?
            'bg-primary text-primary-foreground' :
            'bg-surface-raised text-foreground-secondary border border-border'}
                  `
            }>

                  {filter.label}
                </button>
            )}
            </motion.div>
          }
        </AnimatePresence>

        {/* Results count */}
        {searchQuery || activeFilter !== 'all' ?
        <p data-ev-id="ev_7e58a3dc5a" className="text-sm text-foreground-muted">
            {recipeCount} {recipeCount === 1 ? 'recipe' : 'recipes'} found
          </p> :
        null}

        {/* Loading state */}
        {isLoading ?
        <div data-ev-id="ev_e43c559781" className="py-16 text-center">
            <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />

            <p data-ev-id="ev_6c42fa6af5" className="text-foreground-secondary">Loading recipes...</p>
          </div> :
        filteredRecipes.length === 0 ? (
        /* Empty state */
        <Card variant="ghost" className="py-16 text-center">
            <BookOpen className="w-12 h-12 text-foreground-muted mx-auto mb-4" strokeWidth={1} />
            <h3 data-ev-id="ev_03738ef274" className="font-medium text-foreground mb-2">
              {recipes.length === 0 ? 'No recipes yet' : 'No matching recipes'}
            </h3>
            <p data-ev-id="ev_9bd32ec3eb" className="text-foreground-secondary text-sm mb-4 max-w-xs mx-auto">
              {recipes.length === 0 ?
            'Generate your first recipe based on what\'s in your pantry' :
            'Try adjusting your search or filters'
            }
            </p>
            {recipes.length === 0 &&
          <Button onClick={() => setShowGenerator(true)}>
                <Sparkles className="w-4 h-4" />
                Generate Recipe
              </Button>
          }
          </Card>) : (

        /* Recipe list */
        <div data-ev-id="ev_dc87623e95" className="flex flex-col gap-3 pb-4">
            {filteredRecipes.map((recipe, index) =>
          <motion.div
            key={recipe.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}>

                <RecipeCard
              {...recipe}
              instructions={recipe.instructions.map((text, i) => ({ step: i + 1, text }))}
              onStartCooking={() => navigate(`/cooking?recipeId=${recipe.id}`)}
              onFavorite={() => toggleFavorite(recipe.id)} />

              </motion.div>
          )}
          </div>)
        }
      </div>

      {/* Recipe Generator Modal */}
      <RecipeGenerator isOpen={showGenerator} onClose={() => setShowGenerator(false)} />
    </MobileLayout>);

}