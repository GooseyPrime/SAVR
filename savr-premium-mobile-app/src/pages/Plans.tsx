/**
 * SAVR Meal Plans Page - Complete Implementation
 * Weekly meal planning with add/edit/delete/generate functionality
 */

import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Utensils,
  Coffee,
  Sun,
  Moon,
  X,
  Trash2,
  MoveHorizontal,
  ShoppingCart,
  Sparkles,
  Loader2,
  AlertCircle,
  ChefHat,
  RefreshCw,
  Users } from
'lucide-react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAppStore, type Recipe, type MealPlan } from '@/store/app-store';
import { useMealPlanGeneration } from '@/hooks/use-savr-api';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const mealTypes: {id: MealType;label: string;icon: typeof Coffee;time: string;}[] = [
{ id: 'breakfast', label: 'Breakfast', icon: Coffee, time: '7:00 AM' },
{ id: 'lunch', label: 'Lunch', icon: Sun, time: '12:00 PM' },
{ id: 'dinner', label: 'Dinner', icon: Moon, time: '6:00 PM' },
{ id: 'snack', label: 'Snack', icon: Utensils, time: 'Anytime' }];


const getDaysOfWeek = (startDate: Date) => {
  const days: Date[] = [];
  const start = new Date(startDate);
  start.setDate(start.getDate() - start.getDay());

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    days.push(date);
  }
  return days;
};

const formatDateKey = (date: Date) => date.toISOString().split('T')[0];
const formatDate = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'short' });

interface RecipeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (recipe: Recipe) => void;
  recipes: Recipe[];
}

function RecipeSelector({ isOpen, onClose, onSelect, recipes }: RecipeSelectorProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
    recipes.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase())
    ),
    [recipes, search]
  );

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">

      <div data-ev-id="ev_24bfe7c9e3" className="h-full flex flex-col pt-safe">
        <div data-ev-id="ev_215d1b4780" className="flex items-center justify-between p-4 border-b border-border">
          <h2 data-ev-id="ev_dc34a61550" className="font-display text-lg text-foreground">Select Recipe</h2>
          <button data-ev-id="ev_17a179393e"
          onClick={onClose}
          className="p-2 text-foreground-muted hover:text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center">

            <X className="w-5 h-5" />
          </button>
        </div>

        <div data-ev-id="ev_edd5cc6700" className="p-4">
          <input data-ev-id="ev_2837152256"
          type="text"
          placeholder="Search recipes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface border border-border rounded-[var(--radius-md)] px-4 py-3 text-foreground placeholder:text-foreground-muted" />

        </div>

        <div data-ev-id="ev_50867e35d6" className="flex-1 overflow-y-auto px-4 pb-4">
          {filtered.length === 0 ?
          <div data-ev-id="ev_67950c9810" className="flex flex-col items-center justify-center py-12 text-center">
              <ChefHat className="w-12 h-12 text-foreground-muted mb-4" />
              <p data-ev-id="ev_5078ce82d1" className="text-foreground-secondary">No recipes found</p>
              <p data-ev-id="ev_0cafbd91b9" className="text-sm text-foreground-muted mt-1">
                Generate or save recipes first
              </p>
            </div> :

          <div data-ev-id="ev_8aec777e24" className="flex flex-col gap-3">
              {filtered.map((recipe) =>
            <Card
              key={recipe.id}
              variant="interactive"
              padding="sm"
              className="cursor-pointer"
              onClick={() => {
                onSelect(recipe);
                onClose();
              }}>

                  <div data-ev-id="ev_40e6da5dba" className="flex items-center gap-3">
                    {recipe.imageUrl ?
                <img data-ev-id="ev_ff2a7aad21"
                src={recipe.imageUrl}
                alt={recipe.title}
                className="w-14 h-14 object-cover rounded-[var(--radius-sm)]" /> :


                <div data-ev-id="ev_d5b9cba468" className="w-14 h-14 bg-muted flex items-center justify-center rounded-[var(--radius-sm)]">
                        <ChefHat className="w-6 h-6 text-foreground-muted" />
                      </div>
                }
                    <div data-ev-id="ev_2ef4eb9770" className="flex-1 min-w-0">
                      <p data-ev-id="ev_2dc9252a0d" className="font-medium text-foreground truncate">{recipe.title}</p>
                      <div data-ev-id="ev_6b87bc84da" className="flex items-center gap-2 text-xs text-foreground-muted">
                        <Clock className="w-3 h-3" />
                        <span data-ev-id="ev_992e578ea0">{recipe.prepTime + recipe.cookTime} min</span>
                        <span data-ev-id="ev_e9dfe6477b">•</span>
                        <Users className="w-3 h-3" />
                        <span data-ev-id="ev_81af08e4cd">{recipe.servings} servings</span>
                      </div>
                    </div>
                  </div>
                </Card>
            )}
            </div>
          }
        </div>
      </div>
    </motion.div>);

}

export default function Plans() {
  const navigate = useNavigate();
  const { mealPlans, recipes, preferences, setMealForDate, removeMealPlan, addRecipe } = useAppStore();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [selectingMeal, setSelectingMeal] = useState<MealType | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // AI Meal Plan Generation
  const { generateMealPlan, isGenerating, error: aiError, clearError: clearAIError } = useMealPlanGeneration();

  const daysOfWeek = getDaysOfWeek(currentWeek);
  const selectedDateKey = formatDateKey(selectedDay);

  const currentPlan = useMemo(
    () => mealPlans.find((p) => p.date === selectedDateKey),
    [mealPlans, selectedDateKey]
  );

  const modeRecipes = useMemo(
    () => recipes.filter((r) => r.mode === preferences.recipeMode),
    [recipes, preferences.recipeMode]
  );

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();
  const isSelected = (date: Date) => date.toDateString() === selectedDay.toDateString();

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newDate);
  };

  const handleAddMeal = useCallback(
    (mealType: MealType) => {
      if (modeRecipes.length === 0) {
        setError('No recipes available. Generate or save some recipes first!');
        return;
      }
      setSelectingMeal(mealType);
    },
    [modeRecipes.length]
  );

  const handleSelectRecipe = useCallback(
    (recipe: Recipe) => {
      if (selectingMeal) {
        setMealForDate(selectedDateKey, selectingMeal, recipe);
        setSelectingMeal(null);
      }
    },
    [selectingMeal, selectedDateKey, setMealForDate]
  );

  const handleRemoveMeal = useCallback(
    (mealType: MealType) => {
      setMealForDate(selectedDateKey, mealType, undefined);
    },
    [selectedDateKey, setMealForDate]
  );

  const handleGeneratePlan = useCallback(async () => {
    clearAIError();
    setError(null);

    try {
      // Use AI to generate a meal plan
      const result = await generateMealPlan({
        mode: preferences.recipeMode,
        daysToGenerate: 7,
        preferences: {
          diets: preferences.diets,
          allergies: preferences.allergies,
          mealTypes: ['breakfast', 'lunch', 'dinner'],
          cookingSkill: 'intermediate',
        },
      });

      if (result?.mealPlan?.days) {
        // Process each day from the AI response
        result.mealPlan.days.forEach((dayPlan) => {
          const dateKey = dayPlan.date;
          
          // Convert AI meals to Recipe format and set them
          const mealSlots = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
          mealSlots.forEach((slot) => {
            const meal = dayPlan.meals[slot];
            if (meal) {
              // Create a recipe from the meal plan
              const recipe: Recipe = {
                id: `ai-${dateKey}-${slot}-${Date.now()}`,
                title: meal.title,
                description: meal.description,
                prepTime: meal.prepTime,
                cookTime: meal.cookTime,
                servings: 4,
                difficulty: meal.difficulty,
                mode: preferences.recipeMode,
                ingredients: meal.ingredients.map((ing) => ({
                  name: ing,
                  amount: '',
                  unit: '',
                })),
                instructions: meal.instructions || [`Prepare ${meal.title}`],
                dietaryTags: meal.dietaryTags || [],
                createdAt: new Date().toISOString(),
                isFavorite: false,
                isAiGenerated: true,
              };
              
              // Add recipe and set it for the meal
              addRecipe(recipe);
              setMealForDate(dateKey, slot, recipe);
            }
          });
        });
      } else {
        // No AI response - show honest error
        setError('Unable to generate meal plan. Please check your connection and try again.');
      }
    } catch (err) {
      // AI request failed - show honest error with retry option
      console.error('Meal plan generation failed:', err);
      setError('Failed to generate meal plan. Please try again.');
    }
  }, [generateMealPlan, preferences, setMealForDate, addRecipe, clearAIError]);

  const handleConvertToGroceryList = useCallback(() => {
    // Navigate to grocery list with current plan's ingredients
    if (!currentPlan) return;
    
    // Collect all ingredients from planned meals
    const allIngredients: { name: string; amount: string; unit: string }[] = [];
    const meals = Object.values(currentPlan.meals).filter(Boolean);
    
    meals.forEach((meal) => {
      if (meal?.ingredients) {
        meal.ingredients.forEach((ing) => {
          allIngredients.push({
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
          });
        });
      }
    });
    
    // Store ingredients for grocery list page and navigate
    if (allIngredients.length > 0) {
      sessionStorage.setItem('groceryListIngredients', JSON.stringify(allIngredients));
      navigate('/grocery-list');
    } else {
      setError('No ingredients to add. Please add some meals to your plan first.');
    }
  }, [currentPlan, navigate]);

  const getMealForType = (mealType: MealType): Recipe | undefined => {
    return currentPlan?.meals[mealType];
  };

  const monthYear = currentWeek.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const plannedMealsCount = mealTypes.filter((m) => getMealForType(m.id)).length;

  return (
    <MobileLayout
      title="Meal Plans"
      headerRight={
      <Button size="sm" onClick={handleGeneratePlan} disabled={isGenerating}>
          {isGenerating ?
        <Loader2 className="w-4 h-4 animate-spin" /> :

        <Sparkles className="w-4 h-4" />
        }
          {isGenerating ? 'Generating...' : 'Auto Plan'}
        </Button>
      }>

      <div data-ev-id="ev_25346dca4c" className="flex flex-col">
        {/* Week Navigator */}
        <div data-ev-id="ev_c8d56cf123" className="px-4 py-3 border-b border-border bg-surface">
          <div data-ev-id="ev_cd9d5c0e5f" className="flex items-center justify-between mb-4">
            <button data-ev-id="ev_7267ea931a"
            onClick={() => navigateWeek('prev')}
            className="p-2 rounded-[var(--radius-md)] hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Previous week">

              <ChevronLeft className="w-5 h-5 text-foreground-secondary" />
            </button>
            <h2 data-ev-id="ev_917c3218fe" className="font-display text-lg font-semibold text-foreground">{monthYear}</h2>
            <button data-ev-id="ev_72a5d2acf5"
            onClick={() => navigateWeek('next')}
            className="p-2 rounded-[var(--radius-md)] hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Next week">

              <ChevronRight className="w-5 h-5 text-foreground-secondary" />
            </button>
          </div>

          <div data-ev-id="ev_3a0fe8c39f" className="flex justify-between">
            {daysOfWeek.map((date) =>
            <button data-ev-id="ev_c817afa161"
            key={date.toISOString()}
            onClick={() => setSelectedDay(date)}
            className={`
                  flex flex-col items-center py-2 px-3 rounded-[var(--radius-md)]
                  transition-all duration-200 min-w-[44px] min-h-[44px]
                  ${isSelected(date) ?
            'bg-primary text-primary-foreground' :
            isToday(date) ?
            'bg-primary-light text-primary' :
            'hover:bg-muted text-foreground'}
                `
            }
            aria-label={date.toLocaleDateString()}
            aria-current={isSelected(date) ? 'date' : undefined}>

                <span data-ev-id="ev_0ade9c12b3" className="text-xs font-medium opacity-70">{formatDate(date)}</span>
                <span data-ev-id="ev_a969de1c8b" className="text-lg font-bold mt-0.5">{date.getDate()}</span>
              </button>
            )}
          </div>
        </div>

        {/* Error message */}
        {error &&
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-4 p-3 bg-error/10 border border-error/20 rounded-[var(--radius-md)] flex items-center gap-2">

            <AlertCircle className="w-4 h-4 text-error flex-shrink-0" />
            <p data-ev-id="ev_a066130b1c" className="text-sm text-error">{error}</p>
            <button data-ev-id="ev_6eee00e559"
          onClick={() => setError(null)}
          className="ml-auto p-1 text-error hover:text-error/70">

              <X className="w-4 h-4" />
            </button>
          </motion.div>
        }

        {/* Meals for Selected Day */}
        <div data-ev-id="ev_bfd8de1880" className="px-4 py-4 flex flex-col gap-3">
          <div data-ev-id="ev_332b9d79d2" className="flex items-center justify-between">
            <h3 data-ev-id="ev_56acd7ebb8" className="font-semibold text-foreground">
              {selectedDay.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric'
              })}
            </h3>
            <div data-ev-id="ev_91c8171395" className="flex items-center gap-2">
              {isToday(selectedDay) &&
              <span data-ev-id="ev_53a405f6d0" className="px-2 py-1 bg-primary-light text-primary text-xs font-medium rounded-[var(--radius-full)]">
                  Today
                </span>
              }
              {plannedMealsCount > 0 &&
              <span data-ev-id="ev_195eea7ff1" className="text-xs text-foreground-muted">
                  {plannedMealsCount}/{mealTypes.length} meals
                </span>
              }
            </div>
          </div>

          {mealTypes.map(({ id, label, icon: Icon, time }, index) => {
            const meal = getMealForType(id);
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}>

                <Card className="p-0 overflow-hidden">
                  {meal ?
                  // Meal assigned
                  <div data-ev-id="ev_8114b1fcd8" className="flex items-center gap-3 p-3">
                      {meal.imageUrl ?
                    <img data-ev-id="ev_4fb84c84e7"
                    src={meal.imageUrl}
                    alt={meal.title}
                    className="w-16 h-16 object-cover rounded-[var(--radius-sm)]" /> :


                    <div data-ev-id="ev_f1220c3513" className="w-16 h-16 bg-muted flex items-center justify-center rounded-[var(--radius-sm)]">
                          <Icon className="w-6 h-6 text-foreground-muted" />
                        </div>
                    }
                      <div data-ev-id="ev_6d4209beaa" className="flex-1 min-w-0">
                        <p data-ev-id="ev_6aa5484f5f" className="text-xs text-foreground-muted mb-0.5">{label}</p>
                        <p data-ev-id="ev_48ead5ed7f" className="font-medium text-foreground truncate">{meal.title}</p>
                        <div data-ev-id="ev_77f5b151b6" className="flex items-center gap-2 text-xs text-foreground-muted mt-1">
                          <Clock className="w-3 h-3" />
                          <span data-ev-id="ev_1545b04587">{meal.prepTime + meal.cookTime} min</span>
                          <span data-ev-id="ev_8667dfc541">•</span>
                          <Users className="w-3 h-3" />
                          <span data-ev-id="ev_0c615e7483">{meal.servings}</span>
                        </div>
                      </div>
                      <div data-ev-id="ev_9b4a9d9fcd" className="flex flex-col gap-1">
                        <button data-ev-id="ev_05ddefa1f4"
                      onClick={() => handleAddMeal(id)}
                      className="p-2 text-foreground-muted hover:text-foreground transition-colors"
                      aria-label="Change meal">

                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button data-ev-id="ev_2a3a3a4899"
                      onClick={() => handleRemoveMeal(id)}
                      className="p-2 text-foreground-muted hover:text-error transition-colors"
                      aria-label="Remove meal">

                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div> :

                  // Empty slot
                  <div data-ev-id="ev_54b4066e2a" className="flex items-center gap-4 p-3">
                      <div data-ev-id="ev_7632f97d05" className="w-12 h-12 rounded-[var(--radius-md)] bg-muted flex items-center justify-center">
                        <Icon className="w-6 h-6 text-foreground-muted" />
                      </div>
                      <div data-ev-id="ev_e47f83f9e6" className="flex-1">
                        <p data-ev-id="ev_4803b2312a" className="font-semibold text-foreground">{label}</p>
                        <p data-ev-id="ev_b36e3ecf76" className="text-sm text-foreground-secondary flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {time}
                        </p>
                      </div>
                      <button data-ev-id="ev_a622a5ae93"
                    onClick={() => handleAddMeal(id)}
                    className="w-10 h-10 rounded-[var(--radius-md)] border-2 border-dashed border-border hover:border-primary hover:bg-primary-light/50 flex items-center justify-center transition-colors"
                    aria-label={`Add ${label}`}>

                        <Plus className="w-5 h-5 text-foreground-muted" />
                      </button>
                    </div>
                  }
                </Card>
              </motion.div>);

          })}
        </div>

        {/* Actions */}
        {plannedMealsCount > 0 &&
        <div data-ev-id="ev_dce7a77dc6" className="px-4 pb-4">
            <Button
            variant="outline"
            fullWidth
            onClick={handleConvertToGroceryList}>

              <ShoppingCart className="w-4 h-4" />
              Create Grocery List
            </Button>
          </div>
        }

        {/* Empty State / Tips */}
        {plannedMealsCount === 0 &&
        <div data-ev-id="ev_7dbd3d411a" className="px-4 pb-4">
            <Card variant="ghost" className="bg-accent-light/50 border border-accent/20">
              <div data-ev-id="ev_4399aa9b1e" className="flex items-start gap-3">
                <div data-ev-id="ev_92cf9a0f7e" className="w-10 h-10 rounded-[var(--radius-md)] bg-accent flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-accent-foreground" />
                </div>
                <div data-ev-id="ev_1c401ae143">
                  <p data-ev-id="ev_803497fa9d" className="font-semibold text-foreground">No meals planned</p>
                  <p data-ev-id="ev_017985b3f4" className="text-sm text-foreground-secondary">
                    Tap the + button to add recipes, or use Auto Plan to generate a full week!
                  </p>
                </div>
              </div>
            </Card>
          </div>
        }
      </div>

      {/* Recipe Selector Modal */}
      <AnimatePresence>
        {selectingMeal &&
        <RecipeSelector
          isOpen={true}
          onClose={() => setSelectingMeal(null)}
          onSelect={handleSelectRecipe}
          recipes={modeRecipes} />

        }
      </AnimatePresence>
    </MobileLayout>);

}