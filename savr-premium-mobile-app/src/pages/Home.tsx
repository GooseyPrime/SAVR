/**
 * SAVR Home Dashboard
 * Task-oriented home screen with real data, no marketing fluff
 * Shows: greeting, mode, quick actions, expiring items, today's meals, recent recipes
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  Camera,
  Sparkles,
  AlertTriangle,
  Calendar,
  ChefHat,
  Package,
  Clock,
  ChevronRight,
  Plus,
  ShoppingCart,
  Dog,
  Cat,
  User as UserIcon } from
'lucide-react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Header } from '@/components/layout/Header';
import { Logo } from '@/components/brand/Logo';
import { ModeToggle } from '@/components/ui/ModeToggle';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Scanner } from '@/components/scanner/Scanner';
import { RecipeGenerator } from '@/components/recipes/RecipeGenerator';
import { useAppStore } from '@/store/app-store';

// Get time-based greeting
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Mode icon component
function ModeIcon({ mode }: {mode: 'human' | 'dog' | 'cat';}) {
  const icons = {
    human: UserIcon,
    dog: Dog,
    cat: Cat
  };
  const Icon = icons[mode];
  return <Icon className="w-4 h-4" strokeWidth={1.5} />;
}

// Mode label
function getModeLabel(mode: 'human' | 'dog' | 'cat'): string {
  return mode === 'human' ? 'Human recipes' : `${mode.charAt(0).toUpperCase() + mode.slice(1)} recipes`;
}

export default function Home() {
  const navigate = useNavigate();
  const { inventory, recipes, mealPlans, preferences } = useAppStore();
  const [showScanner, setShowScanner] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);

  // Calculate expiring soon items (within 3 days)
  const expiringItems = useMemo(() => {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    return inventory.filter((item) => {
      if (!item.expirationDate) return false;
      const expDate = new Date(item.expirationDate);
      return expDate <= threeDaysFromNow && expDate >= now;
    }).sort((a, b) => {
      const dateA = new Date(a.expirationDate || 0);
      const dateB = new Date(b.expirationDate || 0);
      return dateA.getTime() - dateB.getTime();
    }).slice(0, 5);
  }, [inventory]);

  // Today's meals
  const todaysMeals = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todaysPlan = mealPlans.find((plan) => plan.date === today);
    if (!todaysPlan) return [];

    const meals: Array<{type: string;recipe: typeof todaysPlan.meals.breakfast;}> = [];
    if (todaysPlan.meals.breakfast) meals.push({ type: 'breakfast', recipe: todaysPlan.meals.breakfast });
    if (todaysPlan.meals.lunch) meals.push({ type: 'lunch', recipe: todaysPlan.meals.lunch });
    if (todaysPlan.meals.dinner) meals.push({ type: 'dinner', recipe: todaysPlan.meals.dinner });
    if (todaysPlan.meals.snack) meals.push({ type: 'snack', recipe: todaysPlan.meals.snack });
    return meals;
  }, [mealPlans]);

  // Recent recipes (last 5)
  const recentRecipes = useMemo(() => {
    return recipes.slice(-5).reverse();
  }, [recipes]);

  // Stats
  const stats = {
    pantryCount: inventory.length,
    recipeCount: recipes.length,
    plannedMeals: mealPlans.length
  };

  return (
    <MobileLayout showHeader={false}>
      {/* Custom header with logo */}
      <header data-ev-id="ev_ae9a594c46" className="sticky top-0 z-20 bg-background/90 backdrop-blur-xl border-b border-border">
        <div data-ev-id="ev_6bb9607076" className="flex items-center justify-between px-4 py-3">
          <div data-ev-id="ev_720197686d" className="flex items-center gap-3">
            <Logo size="sm" variant="mark" />
            <div data-ev-id="ev_b49453c982" className="h-4 w-px bg-border" />
            <button data-ev-id="ev_e220a362ac"
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-surface-raised transition-colors">

              <ModeIcon mode={preferences.recipeMode} />
              <span data-ev-id="ev_dad821d08a" className="text-sm text-foreground-secondary">
                {getModeLabel(preferences.recipeMode)}
              </span>
            </button>
          </div>
          <ModeToggle />
        </div>
      </header>

      <div data-ev-id="ev_8c2409e67f" className="px-4 py-5 flex flex-col gap-6 pb-24">
        {/* Greeting */}
        <section data-ev-id="ev_452611a09f">
          <h1 data-ev-id="ev_c89056a027" className="text-2xl font-display font-medium text-foreground">
            {getGreeting()}
          </h1>
          <p data-ev-id="ev_0681830ce8" className="text-foreground-secondary mt-1">
            What would you like to cook today?
          </p>
        </section>

        {/* Primary Actions */}
        <section data-ev-id="ev_fae6f65246" className="grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowScanner(true)}
            className="
              flex flex-col items-center justify-center gap-3 p-5
              bg-primary text-primary-foreground rounded-xl
              min-h-[120px]
            ">









            <Camera className="w-8 h-8" strokeWidth={1.5} />
            <span data-ev-id="ev_fa3f5cc01c" className="font-medium">Scan Ingredients</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowGenerator(true)}
            className="
              flex flex-col items-center justify-center gap-3 p-5
              bg-surface-raised border border-border rounded-xl
              text-foreground min-h-[120px]
            ">









            <Sparkles className="w-8 h-8 text-primary" strokeWidth={1.5} />
            <span data-ev-id="ev_53d103ec93" className="font-medium">What Can I Make?</span>
          </motion.button>
        </section>

        {/* Quick Stats */}
        <section data-ev-id="ev_2bd5b777f5" className="grid grid-cols-3 gap-3">
          <button data-ev-id="ev_5ee3dc0545"
          onClick={() => navigate('/pantry')}
          className="flex flex-col items-center p-4 bg-surface rounded-lg border border-border">

            <Package className="w-5 h-5 text-foreground-muted mb-2" strokeWidth={1.5} />
            <span data-ev-id="ev_f1916dcd12" className="text-xl font-semibold text-foreground">{stats.pantryCount}</span>
            <span data-ev-id="ev_68aa1c0831" className="text-xs text-foreground-muted">Pantry</span>
          </button>
          <button data-ev-id="ev_31cc77274b"
          onClick={() => navigate('/recipes')}
          className="flex flex-col items-center p-4 bg-surface rounded-lg border border-border">

            <ChefHat className="w-5 h-5 text-foreground-muted mb-2" strokeWidth={1.5} />
            <span data-ev-id="ev_a82e90e224" className="text-xl font-semibold text-foreground">{stats.recipeCount}</span>
            <span data-ev-id="ev_be5d42d974" className="text-xs text-foreground-muted">Recipes</span>
          </button>
          <button data-ev-id="ev_ac6b7c5c6b"
          onClick={() => navigate('/plans')}
          className="flex flex-col items-center p-4 bg-surface rounded-lg border border-border">

            <Calendar className="w-5 h-5 text-foreground-muted mb-2" strokeWidth={1.5} />
            <span data-ev-id="ev_d4fbdd4abc" className="text-xl font-semibold text-foreground">{stats.plannedMeals}</span>
            <span data-ev-id="ev_0bac5b5a8b" className="text-xs text-foreground-muted">Planned</span>
          </button>
        </section>

        {/* Expiring Soon */}
        {expiringItems.length > 0 &&
        <section data-ev-id="ev_550c1ae878">
            <div data-ev-id="ev_4bcf1c7fbe" className="flex items-center justify-between mb-3">
              <div data-ev-id="ev_5c88ac7ca6" className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" strokeWidth={2} />
                <h2 data-ev-id="ev_858213d1eb" className="font-medium text-foreground">Expiring Soon</h2>
              </div>
              <button data-ev-id="ev_ecd25d2c65"
            onClick={() => navigate('/pantry')}
            className="text-sm text-primary flex items-center gap-1">

                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <Card variant="bordered" padding="none" className="divide-y divide-border">
              {expiringItems.map((item) => {
              const expDate = new Date(item.expirationDate!);
              const daysLeft = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              return (
                <div data-ev-id="ev_f81ce17929" key={item.id} className="flex items-center justify-between p-3">
                    <div data-ev-id="ev_1004c92a09">
                      <p data-ev-id="ev_78f77662e1" className="text-foreground font-medium">{item.name}</p>
                      <p data-ev-id="ev_57731821bc" className="text-sm text-foreground-muted">
                        {item.quantity} {item.unit}
                      </p>
                    </div>
                    <span data-ev-id="ev_19cfdbf586" className={`text-sm font-medium ${
                  daysLeft <= 1 ? 'text-error' : 'text-warning'}`
                  }>
                      {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days`}
                    </span>
                  </div>);

            })}
            </Card>
          </section>
        }

        {/* Today's Meals */}
        <section data-ev-id="ev_e8ec2ef40e">
          <div data-ev-id="ev_c83616ba7c" className="flex items-center justify-between mb-3">
            <div data-ev-id="ev_762080e840" className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-foreground-muted" strokeWidth={2} />
              <h2 data-ev-id="ev_0dad29a179" className="font-medium text-foreground">Today's Meals</h2>
            </div>
            <button data-ev-id="ev_167d686e48"
            onClick={() => navigate('/plans')}
            className="text-sm text-primary flex items-center gap-1">

              Plan week <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {todaysMeals.length === 0 ?
          <Card variant="ghost" className="py-8 text-center">
              <Calendar className="w-10 h-10 text-foreground-muted mx-auto mb-3" strokeWidth={1} />
              <p data-ev-id="ev_c50ee98b4b" className="text-foreground-secondary text-sm mb-3">
                No meals planned for today
              </p>
              <Button size="sm" variant="outline" onClick={() => navigate('/plans')}>
                <Plus className="w-4 h-4" />
                Add meal
              </Button>
            </Card> :

          <Card variant="bordered" padding="none" className="divide-y divide-border">
              {todaysMeals.map((meal) =>
            <div data-ev-id="ev_1a8acb617a" key={meal.type} className="flex items-center gap-3 p-3">
                  <div data-ev-id="ev_490078bae4" className="w-10 h-10 bg-surface-raised rounded-lg flex items-center justify-center">
                    <ChefHat className="w-5 h-5 text-foreground-muted" strokeWidth={1.5} />
                  </div>
                  <div data-ev-id="ev_fcc2f0763b" className="flex-1 min-w-0">
                    <p data-ev-id="ev_b33b8698cf" className="text-foreground font-medium truncate">{meal.recipe?.title}</p>
                    <p data-ev-id="ev_b07ad7d74c" className="text-sm text-foreground-muted capitalize">{meal.type}</p>
                  </div>
                  <span data-ev-id="ev_80c964fe4f" className="text-sm text-foreground-muted">
                    {meal.recipe?.servings} servings
                  </span>
                </div>
            )}
            </Card>
          }
        </section>

        {/* Recently Saved Recipes */}
        <section data-ev-id="ev_98a98861c5">
          <div data-ev-id="ev_bc8642c3ea" className="flex items-center justify-between mb-3">
            <div data-ev-id="ev_a43d769a2c" className="flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-foreground-muted" strokeWidth={2} />
              <h2 data-ev-id="ev_500e742cdb" className="font-medium text-foreground">Recent Recipes</h2>
            </div>
            <button data-ev-id="ev_50c252c5af"
            onClick={() => navigate('/recipes')}
            className="text-sm text-primary flex items-center gap-1">

              All recipes <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {recentRecipes.length === 0 ?
          <Card variant="ghost" className="py-8 text-center">
              <ChefHat className="w-10 h-10 text-foreground-muted mx-auto mb-3" strokeWidth={1} />
              <p data-ev-id="ev_ee6116f40b" className="text-foreground-secondary text-sm mb-3">
                No saved recipes yet
              </p>
              <Button size="sm" variant="outline" onClick={() => setShowGenerator(true)}>
                <Sparkles className="w-4 h-4" />
                Generate recipe
              </Button>
            </Card> :

          <div data-ev-id="ev_2b2d0e20b9" className="flex flex-col gap-2">
              {recentRecipes.map((recipe) =>
            <button data-ev-id="ev_ceb45df00f"
            key={recipe.id}
            onClick={() => navigate('/recipes')}
            className="
                    flex items-center gap-3 p-3
                    bg-surface rounded-lg border border-border
                    text-left hover:bg-surface-raised transition-colors
                  ">









                  <div data-ev-id="ev_7631144cc4" className="w-12 h-12 bg-surface-raised rounded-lg flex items-center justify-center shrink-0">
                    <ChefHat className="w-6 h-6 text-foreground-muted" strokeWidth={1.5} />
                  </div>
                  <div data-ev-id="ev_57aead12f5" className="flex-1 min-w-0">
                    <p data-ev-id="ev_88a87e2727" className="text-foreground font-medium truncate">{recipe.title}</p>
                    <div data-ev-id="ev_c6d41a5b35" className="flex items-center gap-3 mt-1">
                      <span data-ev-id="ev_216c9acd60" className="text-xs text-foreground-muted flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {recipe.time} min
                      </span>
                      <span data-ev-id="ev_0da9540196" className="text-xs text-foreground-muted">
                        {recipe.servings} servings
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-foreground-muted shrink-0" />
                </button>
            )}
            </div>
          }
        </section>

        {/* Empty Pantry CTA */}
        {inventory.length === 0 &&
        <section data-ev-id="ev_188200cb25">
            <Card variant="bordered" className="p-5 text-center">
              <Package className="w-12 h-12 text-foreground-muted mx-auto mb-3" strokeWidth={1} />
              <h3 data-ev-id="ev_75939824ab" className="font-medium text-foreground mb-2">Your pantry is empty</h3>
              <p data-ev-id="ev_b3dd6d8476" className="text-sm text-foreground-secondary mb-4">
                Scan your ingredients to get started with personalized recipes
              </p>
              <Button onClick={() => setShowScanner(true)}>
                <Camera className="w-4 h-4" />
                Scan Ingredients
              </Button>
            </Card>
          </section>
        }
      </div>

      {/* Modals */}
      <Scanner isOpen={showScanner} onClose={() => setShowScanner(false)} />
      <RecipeGenerator isOpen={showGenerator} onClose={() => setShowGenerator(false)} />
    </MobileLayout>);

}