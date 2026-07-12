/**
 * Recipe Generator Component - Neo-Brutalist
 * AI-powered recipe generation command interface
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Loader2,
  Package,
  ChefHat,
  Dog,
  Cat,
  AlertCircle,
  X } from
'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { RecipeCard } from './RecipeCard';
import { useRecipeGeneration } from '@/hooks/use-savr-api';
import { useAppStore, type RecipeMode } from '@/store/app-store';

interface RecipeGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
}

const difficultyOptions = [
{ id: 'easy', label: 'EASY' },
{ id: 'medium', label: 'MEDIUM' },
{ id: 'hard', label: 'HARD' }] as
const;

const timeOptions = [
{ id: 15, label: '15M' },
{ id: 30, label: '30M' },
{ id: 60, label: '1H' },
{ id: 0, label: 'ANY' }];


const modeIcons = {
  human: ChefHat,
  dog: Dog,
  cat: Cat
};

const modeColors = {
  human: 'border-primary text-primary',
  dog: 'border-peach text-peach',
  cat: 'border-mint text-mint'
};

export function RecipeGenerator({ isOpen, onClose }: RecipeGeneratorProps) {
  const { preferences, inventory, addRecipe } = useAppStore();
  const { generateRecipe, isGenerating, error, clearError } = useRecipeGeneration();

  const [step, setStep] = useState<'options' | 'result'>('options');
  const [customPrompt, setCustomPrompt] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [maxTime, setMaxTime] = useState<number>(30);
  const [useInventory, setUseInventory] = useState(true);
  const [generatedRecipe, setGeneratedRecipe] = useState<{
    title: string;
    description: string;
    ingredients: { name: string; amount: string; unit: string }[];
    instructions: { text: string }[];
    prepTime: number;
    cookTime: number;
    servings: number;
    difficulty: 'easy' | 'medium' | 'hard';
    dietaryTags: string[];
  } | null>(null);

  const mode = preferences.recipeMode;
  const ModeIcon = modeIcons[mode];

  const handleGenerate = useCallback(async () => {
    clearError();

    const result = await generateRecipe({
      mode,
      ingredients: useInventory ? inventory.map((i) => i.name) : [],
      preferences: {
        diets: preferences.diets,
        allergies: preferences.allergies,
        cuisinePreferences: preferences.cuisinePreferences,
        maxTime: maxTime || undefined,
        difficulty
      },
      prompt: customPrompt || undefined
    });

    if (result?.recipe) {
      setGeneratedRecipe(result.recipe);
      setStep('result');
    }
  }, [mode, useInventory, inventory, preferences, maxTime, difficulty, customPrompt, generateRecipe, clearError]);

  const handleSaveRecipe = useCallback(() => {
    if (!generatedRecipe) return;

    addRecipe({
      title: generatedRecipe.title,
      description: generatedRecipe.description,
      ingredients: generatedRecipe.ingredients,
      instructions: generatedRecipe.instructions.map((i) => i.text),
      prepTime: generatedRecipe.prepTime,
      cookTime: generatedRecipe.cookTime,
      servings: generatedRecipe.servings,
      difficulty: generatedRecipe.difficulty,
      dietaryTags: generatedRecipe.dietaryTags,
      isFavorite: false,
      isAiGenerated: true,
      mode
    });

    onClose();
  }, [generatedRecipe, mode, addRecipe, onClose]);

  const handleClose = useCallback(() => {
    setStep('options');
    setGeneratedRecipe(null);
    setCustomPrompt('');
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60"
        onClick={handleClose} />


      <motion.div
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="
          fixed bottom-0 left-0 right-0 z-50
          bg-background border-t border-border
          max-h-[90vh] overflow-y-auto
        "




        onClick={(e) => e.stopPropagation()}>

        {/* Handle */}
        <div data-ev-id="ev_1f9d6c74e1" className="sticky top-0 bg-background pt-3 pb-2 z-10">
          <div data-ev-id="ev_19baf37b85" className="w-12 h-1 bg-border-strong mx-auto" />
        </div>

        {step === 'options' &&
        <div data-ev-id="ev_31a035b49b" className="px-6 pb-safe">
            {/* Header */}
            <div data-ev-id="ev_ad1d87e952" className="flex items-center justify-between mb-6">
              <div data-ev-id="ev_1a04825905" className="flex items-center gap-3">
                <div data-ev-id="ev_c2eb249d28" className={`w-12 h-12 border-2 ${modeColors[mode]} flex items-center justify-center`}>
                  <ModeIcon className="w-6 h-6" />
                </div>
                <div data-ev-id="ev_2dd81afa14">
                  <h2 data-ev-id="ev_8a6b90c24d" className="font-mono text-sm font-semibold text-foreground tracking-wider">GENERATE RECIPE</h2>
                  <p data-ev-id="ev_3cde84f9ec" className="text-xs text-foreground-muted font-mono">
                    {mode === 'human' ? 'AI CULINARY ENGINE' : `${mode.toUpperCase()}-SAFE MODE`}
                  </p>
                </div>
              </div>
              <button data-ev-id="ev_4c32931b48" onClick={handleClose} className="p-2">
                <X className="w-5 h-5 text-foreground-muted" />
              </button>
            </div>

            {/* Custom prompt */}
            <div data-ev-id="ev_d4bf137f87" className="mb-6">
              <Input
              label="Request"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g., Italian comfort food, quick lunch..." />

            </div>

            {/* Use inventory toggle */}
            <button data-ev-id="ev_903a67ab9d"
          onClick={() => setUseInventory(!useInventory)}
          className={`
                w-full p-4 border mb-6 flex items-center gap-3
                transition-all duration-150
                ${useInventory ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground-secondary'}
              `}>

              <div data-ev-id="ev_1091f3988f" className={`w-10 h-10 border flex items-center justify-center ${useInventory ? 'border-primary' : 'border-border'}`}>
                <Package className={`w-5 h-5 ${useInventory ? 'text-primary' : 'text-foreground-muted'}`} />
              </div>
              <div data-ev-id="ev_be4a0e96ae" className="flex-1 text-left">
                <p data-ev-id="ev_556a27e259" className="font-mono text-xs text-foreground tracking-wider">USE PANTRY</p>
                <p data-ev-id="ev_9228801d6a" className="text-xs text-foreground-muted font-mono">
                  {inventory.length} ITEMS AVAILABLE
                </p>
              </div>
              <div data-ev-id="ev_87a5978dd2" className={`w-6 h-6 border-2 flex items-center justify-center ${useInventory ? 'border-primary bg-primary' : 'border-border'}`}>
                {useInventory && <span data-ev-id="ev_cc491b3996" className="w-2 h-2 bg-primary-foreground" />}
              </div>
            </button>

            {/* Difficulty */}
            <div data-ev-id="ev_618a40a50d" className="mb-6">
              <label data-ev-id="ev_7af222f1f9" className="text-xs font-mono text-foreground-muted mb-3 block tracking-wider">DIFFICULTY</label>
              <div data-ev-id="ev_b61cbc041e" className="flex gap-2">
                {difficultyOptions.map(({ id, label }) =>
              <button data-ev-id="ev_bd74956e06"
              key={id}
              onClick={() => setDifficulty(id)}
              className={`
                      flex-1 py-3 text-xs font-mono tracking-wider
                      transition-all duration-150 border
                      ${difficulty === id ?
              'bg-primary text-primary-foreground border-primary' :
              'border-border text-foreground-secondary hover:border-primary'}
                    `}>

                    {label}
                  </button>
              )}
              </div>
            </div>

            {/* Max time */}
            <div data-ev-id="ev_b8ec390e7e" className="mb-8">
              <label data-ev-id="ev_9c94e88a1b" className="text-xs font-mono text-foreground-muted mb-3 block tracking-wider">MAX TIME</label>
              <div data-ev-id="ev_5858ad1dc8" className="flex gap-2">
                {timeOptions.map(({ id, label }) =>
              <button data-ev-id="ev_d58326422a"
              key={id}
              onClick={() => setMaxTime(id)}
              className={`
                      flex-1 py-3 text-xs font-mono tracking-wider
                      transition-all duration-150 border
                      ${maxTime === id ?
              'bg-primary text-primary-foreground border-primary' :
              'border-border text-foreground-secondary hover:border-primary'}
                    `}>

                    {label}
                  </button>
              )}
              </div>
            </div>

            {/* Error display */}
            {error &&
          <div data-ev-id="ev_97efc520c7" className="mb-4 p-4 bg-error/10 border border-error/30 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-error shrink-0" />
                <p data-ev-id="ev_828c7706cb" className="text-error text-sm font-mono">{error}</p>
              </div>
          }

            {/* Generate button */}
            <Button
            fullWidth
            size="lg"
            onClick={handleGenerate}
            disabled={isGenerating}>

              {isGenerating ?
            <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  GENERATING...
                </> :

            <>
                  <Sparkles className="w-5 h-5" />
                  GENERATE
                </>
            }
            </Button>

            <div data-ev-id="ev_0abb4cb1fd" className="h-6" />
          </div>
        }

        {step === 'result' && generatedRecipe &&
        <div data-ev-id="ev_c16c124332" className="px-4 pb-safe">
            {/* Back button */}
            <div data-ev-id="ev_07f2bcd2bb" className="flex items-center justify-between mb-4">
              <button data-ev-id="ev_ad424ff298"
            onClick={() => setStep('options')}
            className="text-primary text-xs font-mono hover:underline tracking-wider">

                ← GENERATE ANOTHER
              </button>
              <button data-ev-id="ev_e76e87fffd" onClick={handleClose} className="p-2">
                <X className="w-5 h-5 text-foreground-muted" />
              </button>
            </div>

            {/* Recipe card */}
            <RecipeCard
              title={generatedRecipe.title}
              description={generatedRecipe.description}
              ingredients={generatedRecipe.ingredients}
              instructions={generatedRecipe.instructions.map((i, idx) => ({ step: idx + 1, text: i.text }))}
              prepTime={generatedRecipe.prepTime}
              cookTime={generatedRecipe.cookTime}
              servings={generatedRecipe.servings}
              difficulty={generatedRecipe.difficulty}
              dietaryTags={generatedRecipe.dietaryTags}
              mode={mode}
              onStartCooking={handleSaveRecipe}
              onFavorite={() => {}}
              onShare={() => {}} />


            {/* Save button */}
            <div data-ev-id="ev_edaaeafc0c" className="mt-4">
              <Button fullWidth variant="outline" onClick={handleSaveRecipe}>
                SAVE TO RECIPES
              </Button>
            </div>

            <div data-ev-id="ev_f4347bc9d5" className="h-6" />
          </div>
        }
      </motion.div>
    </AnimatePresence>);

}