/**
 * Recipe Card Component - Neo-Brutalist
 * Steel-framed recipe display with rigid structure
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock,
  Users,
  ChefHat,
  Heart,
  Share2,
  ChevronDown,
  ChevronUp,
  Play,
  Check,
  AlertTriangle,
  Dog,
  Cat } from
'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { RecipeMode } from '@/store/app-store';

interface Ingredient {
  name: string;
  amount: string;
  unit: string;
  optional?: boolean;
}

interface Instruction {
  step: number;
  text: string;
  time?: number;
  tip?: string;
}

interface RecipeCardProps {
  title: string;
  description: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  cuisine?: string;
  dietaryTags?: string[];
  nutritionalInfo?: {
    calories?: number;
    protein?: string;
    carbs?: string;
    fat?: string;
  };
  tips?: string[];
  safetyNotes?: string[];
  mode?: RecipeMode;
  imageUrl?: string;
  isFavorite?: boolean;
  onFavorite?: () => void;
  onShare?: () => void;
  onStartCooking?: () => void;
}

const difficultyColors = {
  easy: 'text-primary border-primary/30 bg-primary/10',
  medium: 'text-warning border-warning/30 bg-warning/10',
  hard: 'text-error border-error/30 bg-error/10'
};

const modeIcons = {
  human: ChefHat,
  dog: Dog,
  cat: Cat
};

const modeColors = {
  human: 'border-primary bg-primary/10 text-primary',
  dog: 'border-pet bg-pet/10 text-pet',
  cat: 'border-secondary bg-secondary/10 text-secondary'
};

export function RecipeCard({
  title,
  description,
  ingredients,
  instructions,
  prepTime,
  cookTime,
  servings,
  difficulty,
  cuisine,
  dietaryTags = [],
  nutritionalInfo,
  tips = [],
  safetyNotes = [],
  mode = 'human',
  imageUrl,
  isFavorite = false,
  onFavorite,
  onShare,
  onStartCooking
}: RecipeCardProps) {
  const [showIngredients, setShowIngredients] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const ModeIcon = modeIcons[mode];
  const totalTime = prepTime + cookTime;

  const toggleStep = (step: number) => {
    setCompletedSteps((prev) =>
    prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step]
    );
  };

  return (
    <Card padding="none" className="overflow-hidden">
      {/* Header */}
      {imageUrl ?
      <div data-ev-id="ev_410ba06b3e" className="aspect-video relative">
          <img data-ev-id="ev_248753976c" src={imageUrl} alt={title} className="w-full h-full object-cover" />
          <div data-ev-id="ev_cc83019314" className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
          <div data-ev-id="ev_dee28be270" className="absolute bottom-4 left-4 right-4">
            <h2 data-ev-id="ev_386685ea02" className="font-display text-xl font-bold text-foreground">{title}</h2>
          </div>
        </div> :

      <div data-ev-id="ev_835a48b3d8" className={`p-6 border-b ${modeColors[mode]}`}>
          <div data-ev-id="ev_9b6dd8523d" className="flex items-start justify-between">
            <div data-ev-id="ev_8170ac813c" className="flex-1">
              <div data-ev-id="ev_62487f346b" className="flex items-center gap-2 mb-2">
                <ModeIcon className="w-5 h-5" />
                {mode !== 'human' &&
              <span data-ev-id="ev_5dba1da327" className="text-xs font-mono uppercase tracking-wider">
                    {mode} SAFE
                  </span>
              }
              </div>
              <h2 data-ev-id="ev_71270e0a58" className="font-display text-xl font-bold text-foreground">{title}</h2>
            </div>
          </div>
        </div>
      }

      {/* Quick Stats */}
      <div data-ev-id="ev_b8777bd117" className="flex items-center gap-4 p-4 border-b border-border bg-surface">
        <div data-ev-id="ev_356cbf451a" className="flex items-center gap-1.5 text-xs font-mono">
          <Clock className="w-4 h-4 text-foreground-muted" />
          <span data-ev-id="ev_5ae5a89d5a" className="text-foreground-secondary">{totalTime}M</span>
        </div>
        <div data-ev-id="ev_48037fb829" className="flex items-center gap-1.5 text-xs font-mono">
          <Users className="w-4 h-4 text-foreground-muted" />
          <span data-ev-id="ev_ca78cc7989" className="text-foreground-secondary">{servings}</span>
        </div>
        <span data-ev-id="ev_ec5f5c9ae8" className={`px-2 py-0.5 text-[10px] font-mono uppercase border ${difficultyColors[difficulty]}`}>
          {difficulty}
        </span>
        {cuisine &&
        <span data-ev-id="ev_324da70bfb" className="text-xs text-foreground-muted font-mono">{cuisine.toUpperCase()}</span>
        }
      </div>

      {/* Description */}
      <div data-ev-id="ev_715e5545a2" className="p-4 border-b border-border">
        <p data-ev-id="ev_ec52fa6f4a" className="text-foreground-secondary text-sm">{description}</p>
        
        {dietaryTags.length > 0 &&
        <div data-ev-id="ev_da97111bff" className="flex flex-wrap gap-1.5 mt-3">
            {dietaryTags.map((tag) =>
          <span data-ev-id="ev_ec9379f424"
          key={tag}
          className="px-2 py-0.5 bg-surface border border-border text-[10px] text-foreground-muted font-mono uppercase">

                {tag}
              </span>
          )}
          </div>
        }
      </div>

      {/* Safety Notes */}
      {safetyNotes.length > 0 &&
      <div data-ev-id="ev_2ec56dee65" className="p-4 bg-error/5 border-b border-error/20">
          <div data-ev-id="ev_781421b442" className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
            <div data-ev-id="ev_287b413a5e">
              <p data-ev-id="ev_0e4a9a6624" className="font-mono text-xs font-semibold text-error mb-1 tracking-wider">SAFETY NOTES</p>
              <ul data-ev-id="ev_f52aacafbc" className="flex flex-col gap-1">
                {safetyNotes.map((note, i) =>
              <li data-ev-id="ev_0c70de3d81" key={i} className="text-sm text-foreground-secondary">
                    • {note}
                  </li>
              )}
              </ul>
            </div>
          </div>
        </div>
      }

      {/* Ingredients Section */}
      <div data-ev-id="ev_45354c266a" className="border-b border-border">
        <button data-ev-id="ev_5be3b173c0"
        onClick={() => setShowIngredients(!showIngredients)}
        className="w-full flex items-center justify-between p-4 hover:bg-surface-raised transition-colors">

          <span data-ev-id="ev_372d9f8b10" className="font-mono text-xs font-semibold text-foreground tracking-wider">
            INGREDIENTS ({ingredients.length})
          </span>
          {showIngredients ?
          <ChevronUp className="w-5 h-5 text-foreground-muted" /> :

          <ChevronDown className="w-5 h-5 text-foreground-muted" />
          }
        </button>
        
        <AnimatePresence>
          {showIngredients &&
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">

              <ul data-ev-id="ev_9a0133d47e" className="px-4 pb-4 flex flex-col gap-2">
                {ingredients.map((ing, i) =>
              <li data-ev-id="ev_0ed2cb5177"
              key={i}
              className={`flex items-center gap-2 text-sm ${ing.optional ? 'text-foreground-muted' : 'text-foreground-secondary'}`}>

                    <span data-ev-id="ev_8080e753d9" className="w-1.5 h-1.5 bg-primary shrink-0" />
                    <span data-ev-id="ev_cc2949206c" className="font-mono text-primary">{ing.amount} {ing.unit}</span>
                    <span data-ev-id="ev_3f6fa9e28e">{ing.name}</span>
                    {ing.optional && <span data-ev-id="ev_aaa0037e22" className="text-xs text-foreground-muted font-mono">(OPT)</span>}
                  </li>
              )}
              </ul>
            </motion.div>
          }
        </AnimatePresence>
      </div>

      {/* Instructions Section */}
      <div data-ev-id="ev_0c545632af" className="border-b border-border">
        <button data-ev-id="ev_49f2948b6e"
        onClick={() => setShowInstructions(!showInstructions)}
        className="w-full flex items-center justify-between p-4 hover:bg-surface-raised transition-colors">

          <span data-ev-id="ev_fccac90be6" className="font-mono text-xs font-semibold text-foreground tracking-wider">
            INSTRUCTIONS ({instructions.length})
          </span>
          {showInstructions ?
          <ChevronUp className="w-5 h-5 text-foreground-muted" /> :

          <ChevronDown className="w-5 h-5 text-foreground-muted" />
          }
        </button>
        
        <AnimatePresence>
          {showInstructions &&
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">

              <ol data-ev-id="ev_561a19b545" className="px-4 pb-4 flex flex-col gap-4">
                {instructions.map((inst) =>
              <li data-ev-id="ev_026c1e2445" key={inst.step} className="flex gap-3">
                    <button data-ev-id="ev_5ab3952441"
                onClick={() => toggleStep(inst.step)}
                className={`
                        w-7 h-7 shrink-0 flex items-center justify-center
                        font-mono text-sm transition-all duration-150 border
                        ${completedSteps.includes(inst.step) ?
                'bg-primary border-primary text-primary-foreground' :
                'border-border text-foreground-secondary hover:border-primary'}
                      `}>

                      {completedSteps.includes(inst.step) ?
                  <Check className="w-4 h-4" /> :

                  inst.step
                  }
                    </button>
                    <div data-ev-id="ev_e85f4c75e0" className="flex-1">
                      <p data-ev-id="ev_ffd809ea0f" className={`text-sm ${completedSteps.includes(inst.step) ? 'text-foreground-muted line-through' : 'text-foreground-secondary'}`}>
                        {inst.text}
                      </p>
                      {inst.time &&
                  <p data-ev-id="ev_dac7adf7bb" className="text-xs text-foreground-muted mt-1 font-mono">
                          ⏱ {inst.time}M
                        </p>
                  }
                      {inst.tip &&
                  <p data-ev-id="ev_ba6397708e" className="text-xs text-primary mt-1 font-mono">
                          TIP: {inst.tip}
                        </p>
                  }
                    </div>
                  </li>
              )}
              </ol>
            </motion.div>
          }
        </AnimatePresence>
      </div>

      {/* Tips */}
      {tips.length > 0 &&
      <div data-ev-id="ev_5b85b19205" className="p-4 border-b border-border bg-primary/5">
          <p data-ev-id="ev_ca5878a04d" className="font-mono text-xs font-semibold text-foreground mb-2 tracking-wider">PRO TIPS</p>
          <ul data-ev-id="ev_be92250e61" className="flex flex-col gap-1">
            {tips.map((tip, i) =>
          <li data-ev-id="ev_7dce142be2" key={i} className="text-sm text-foreground-secondary">→ {tip}</li>
          )}
          </ul>
        </div>
      }

      {/* Nutrition Info */}
      {nutritionalInfo &&
      <div data-ev-id="ev_0edc34a220" className="p-4 border-b border-border">
          <p data-ev-id="ev_67e992cc1a" className="font-mono text-xs font-semibold text-foreground mb-2 tracking-wider">NUTRITION /SERVING</p>
          <div data-ev-id="ev_83cf716a74" className="flex gap-4">
            {nutritionalInfo.calories &&
          <div data-ev-id="ev_de08082902" className="text-center">
                <p data-ev-id="ev_df7ab46e58" className="text-lg font-mono font-bold text-foreground">{nutritionalInfo.calories}</p>
                <p data-ev-id="ev_a80456eeff" className="text-[10px] text-foreground-muted font-mono">KCAL</p>
              </div>
          }
            {nutritionalInfo.protein &&
          <div data-ev-id="ev_7a0bd5da49" className="text-center">
                <p data-ev-id="ev_4830c7cbca" className="text-lg font-mono font-bold text-foreground">{nutritionalInfo.protein}</p>
                <p data-ev-id="ev_028cb01ea7" className="text-[10px] text-foreground-muted font-mono">PROTEIN</p>
              </div>
          }
            {nutritionalInfo.carbs &&
          <div data-ev-id="ev_fe664b1764" className="text-center">
                <p data-ev-id="ev_a5d5eceda3" className="text-lg font-mono font-bold text-foreground">{nutritionalInfo.carbs}</p>
                <p data-ev-id="ev_d953ee2335" className="text-[10px] text-foreground-muted font-mono">CARBS</p>
              </div>
          }
            {nutritionalInfo.fat &&
          <div data-ev-id="ev_3950c8cb2a" className="text-center">
                <p data-ev-id="ev_d7fcaface1" className="text-lg font-mono font-bold text-foreground">{nutritionalInfo.fat}</p>
                <p data-ev-id="ev_bf9f13fc7b" className="text-[10px] text-foreground-muted font-mono">FAT</p>
              </div>
          }
          </div>
        </div>
      }

      {/* Actions */}
      <div data-ev-id="ev_91670ed96b" className="p-4 flex gap-3">
        <Button fullWidth onClick={onStartCooking}>
          <Play className="w-4 h-4" />
          START
        </Button>
        <button data-ev-id="ev_2fe9b64963"
        onClick={onFavorite}
        className={`
            w-12 h-12 flex items-center justify-center
            border transition-all duration-150
            ${isFavorite ?
        'bg-error/10 border-error/30 text-error' :
        'border-border hover:border-foreground-secondary text-foreground-muted'}
          `}>

          <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
        <button data-ev-id="ev_2cac397e4b"
        onClick={onShare}
        className="
            w-12 h-12 flex items-center justify-center
            border border-border hover:border-foreground-secondary
            text-foreground-muted transition-all duration-150
          ">





          <Share2 className="w-5 h-5" />
        </button>
      </div>
    </Card>);

}