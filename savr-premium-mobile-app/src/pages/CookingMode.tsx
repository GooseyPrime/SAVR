/**
 * SAVR Cooking Mode - Step-by-step cooking assistant
 * Distraction-free interface for following recipes
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  Check,
  Play,
  Pause,
  RotateCcw,
  Users,
  Plus,
  Minus,
  Sparkles,
  AlertTriangle,
  Dog,
  Cat,
  Volume2 } from
'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAppStore, type Recipe } from '@/store/app-store';

interface Timer {
  id: string;
  label: string;
  duration: number; // seconds
  remaining: number;
  isRunning: boolean;
}

export default function CookingMode() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { recipes, preferences } = useAppStore();

  const recipeId = searchParams.get('recipeId');
  const recipe = recipes.find((r) => r.id === recipeId);

  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [servingScale, setServingScale] = useState(() => {
    // Initialize from recipe servings vs user preference
    if (recipe && preferences.defaultServings) {
      return preferences.defaultServings / (recipe.servings || 4);
    }
    return 1;
  });
  const [timers, setTimers] = useState<Timer[]>([]);
  const [showIngredients, setShowIngredients] = useState(false);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  // Keep screen awake
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          lock = await navigator.wakeLock.request('screen');
          setWakeLock(lock);
        }
      } catch (err) {
        console.log('Wake Lock not available:', err);
      }
    };
    
    requestWakeLock();
    
    // Handle visibility change - re-acquire wake lock when page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !lock) {
        requestWakeLock();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (lock) {
        lock.release().catch(() => {});
      }
    };
  }, []); // Empty dependency array - only run on mount/unmount

  // Timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) =>
      prev.map((timer) => {
        if (timer.isRunning && timer.remaining > 0) {
          const newRemaining = timer.remaining - 1;
          if (newRemaining === 0) {
            // Timer finished - could play sound
            alert(`Timer "${timer.label}" finished!`);
          }
          return { ...timer, remaining: newRemaining };
        }
        return timer;
      })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const addTimer = useCallback((label: string, minutes: number) => {
    setTimers((prev) => [
    ...prev,
    {
      id: crypto.randomUUID(),
      label,
      duration: minutes * 60,
      remaining: minutes * 60,
      isRunning: true
    }]
    );
  }, []);

  const toggleTimer = useCallback((id: string) => {
    setTimers((prev) =>
    prev.map((t) => t.id === id ? { ...t, isRunning: !t.isRunning } : t)
    );
  }, []);

  const resetTimer = useCallback((id: string) => {
    setTimers((prev) =>
    prev.map((t) => t.id === id ? { ...t, remaining: t.duration, isRunning: false } : t)
    );
  }, []);

  const removeTimer = useCallback((id: string) => {
    setTimers((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleStepComplete = useCallback((step: number) => {
    setCompletedSteps((prev) =>
    prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step]
    );
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!recipe) {
    return (
      <div data-ev-id="ev_86e31e66ea" className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <AlertTriangle className="w-12 h-12 text-warning mb-4" />
        <p data-ev-id="ev_58277f2196" className="text-foreground-secondary mb-4">Recipe not found</p>
        <Button onClick={() => navigate('/recipes')}>Back to Recipes</Button>
      </div>);

  }

  const totalSteps = recipe.instructions.length;
  const progress = (currentStep + 1) / totalSteps * 100;
  const isPetMode = recipe.mode === 'dog' || recipe.mode === 'cat';

  const scaleAmount = (amount: string) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return amount;
    const scaled = num * servingScale;
    return scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(1);
  };

  return (
    <div data-ev-id="ev_90bbc49b0d" className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div data-ev-id="ev_c698a3ff94" className="pt-safe border-b border-border bg-surface">
        <div data-ev-id="ev_71bf47e0a9" className="flex items-center justify-between p-4">
          <button data-ev-id="ev_ca2093b053"
          onClick={() => navigate('/recipes')}
          className="p-2 text-foreground-muted hover:text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Exit cooking mode">

            <X className="w-5 h-5" />
          </button>
          <div data-ev-id="ev_e47b63ded0" className="text-center flex-1">
            <h1 data-ev-id="ev_5f2071db7a" className="font-display text-lg font-light text-foreground truncate px-4">
              {recipe.title}
            </h1>
            <p data-ev-id="ev_c2afc7acb1" className="text-xs text-foreground-muted">
              Step {currentStep + 1} of {totalSteps}
            </p>
          </div>
          <button data-ev-id="ev_a926e879c5"
          onClick={() => setShowIngredients(!showIngredients)}
          className="p-2 text-foreground-muted hover:text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Toggle ingredients">

            <Users className="w-5 h-5" />
          </button>
        </div>
        {/* Progress bar */}
        <div data-ev-id="ev_eb591633a0" className="h-1 bg-muted">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }} />

        </div>
      </div>

      {/* Pet mode warning */}
      {isPetMode &&
      <div data-ev-id="ev_f4f48ccfed" className="mx-4 mt-4 p-3 bg-warning/10 border border-warning/20 rounded-[var(--radius-md)] flex items-center gap-2">
          {recipe.mode === 'dog' ?
        <Dog className="w-4 h-4 text-warning flex-shrink-0" /> :

        <Cat className="w-4 h-4 text-warning flex-shrink-0" />
        }
          <p data-ev-id="ev_4ed7557e2b" className="text-xs text-warning">
            {recipe.mode === 'dog' ? 'Dog' : 'Cat'} recipe – ensure all ingredients are safe for your pet
          </p>
        </div>
      }

      {/* Ingredients sidebar */}
      <AnimatePresence>
        {showIngredients &&
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-b border-border overflow-hidden">

            <div data-ev-id="ev_e8616e658c" className="p-4">
              <div data-ev-id="ev_b78dd3b3be" className="flex items-center justify-between mb-3">
                <h3 data-ev-id="ev_647f3f77fb" className="font-medium text-foreground">Ingredients</h3>
                <div data-ev-id="ev_7cf30050a6" className="flex items-center gap-2">
                  <button data-ev-id="ev_4a90e09253"
                onClick={() => setServingScale(Math.max(0.5, servingScale - 0.5))}
                className="w-8 h-8 border border-border flex items-center justify-center rounded-[var(--radius-sm)]"
                aria-label="Decrease servings">

                    <Minus className="w-4 h-4" />
                  </button>
                  <span data-ev-id="ev_d9d5bdcf8d" className="text-sm text-foreground w-16 text-center">
                    {servingScale}x
                  </span>
                  <button data-ev-id="ev_d0fc7e0d54"
                onClick={() => setServingScale(servingScale + 0.5)}
                className="w-8 h-8 border border-border flex items-center justify-center rounded-[var(--radius-sm)]"
                aria-label="Increase servings">

                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div data-ev-id="ev_daa2f2b0ea" className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                {recipe.ingredients.map((ing, i) =>
              <div data-ev-id="ev_bddcb80914" key={i} className="flex items-center gap-2 text-sm">
                    <span data-ev-id="ev_3e7e34fdad" className="text-primary font-mono">
                      {scaleAmount(ing.amount)} {ing.unit}
                    </span>
                    <span data-ev-id="ev_9564f838d7" className="text-foreground-secondary">{ing.name}</span>
                  </div>
              )}
              </div>
            </div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Current step */}
      <div data-ev-id="ev_227577fae4" className="flex-1 flex flex-col p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col">

            <Card className="flex-1 flex flex-col">
              <div data-ev-id="ev_931cdc2730" className="flex-1 p-6">
                <div data-ev-id="ev_1d21db1810" className="flex items-start gap-4">
                  <button data-ev-id="ev_3f889d5932"
                  onClick={() => toggleStepComplete(currentStep)}
                  className={`
                      w-10 h-10 rounded-full border-2 flex items-center justify-center
                      flex-shrink-0 transition-all
                      ${completedSteps.includes(currentStep) ?
                  'bg-primary border-primary text-primary-foreground' :
                  'border-border hover:border-primary'}
                    `
                  }
                  aria-label={completedSteps.includes(currentStep) ? 'Mark incomplete' : 'Mark complete'}>

                    {completedSteps.includes(currentStep) ?
                    <Check className="w-5 h-5" /> :

                    <span data-ev-id="ev_57cd75b835" className="font-bold">{currentStep + 1}</span>
                    }
                  </button>
                  <p data-ev-id="ev_0b119c6a24" className="text-lg text-foreground leading-relaxed">
                    {recipe.instructions[currentStep]}
                  </p>
                </div>
              </div>

              {/* Quick timer buttons */}
              <div data-ev-id="ev_abd5cdf779" className="border-t border-border p-4">
                <p data-ev-id="ev_c4916b206c" className="text-xs text-foreground-muted mb-2">Quick timers</p>
                <div data-ev-id="ev_c081587810" className="flex gap-2 flex-wrap">
                  {[1, 3, 5, 10, 15, 30].map((mins) =>
                  <button data-ev-id="ev_b2c7643430"
                  key={mins}
                  onClick={() => addTimer(`${mins} min`, mins)}
                  className="px-3 py-1.5 text-xs bg-muted hover:bg-primary/10 rounded-[var(--radius-sm)] text-foreground-secondary hover:text-primary transition-colors">

                      <Clock className="w-3 h-3 inline mr-1" />
                      {mins}m
                    </button>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Active timers */}
        {timers.length > 0 &&
        <div data-ev-id="ev_aa2ccdb70b" className="mt-4 flex flex-col gap-2">
            {timers.map((timer) =>
          <Card key={timer.id} padding="sm" className="flex items-center gap-3">
                <div data-ev-id="ev_7e67bad5f7"
            className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    ${timer.remaining === 0 ?
            'bg-success text-success-foreground animate-pulse' :
            timer.isRunning ?
            'bg-primary/20 text-primary' :
            'bg-muted text-foreground-muted'}
                  `
            }>

                  {timer.remaining === 0 ?
              <Volume2 className="w-5 h-5" /> :

              <Clock className="w-5 h-5" />
              }
                </div>
                <div data-ev-id="ev_36ebe2bc65" className="flex-1">
                  <p data-ev-id="ev_331fd1ca4a" className="text-sm font-medium text-foreground">{timer.label}</p>
                  <p data-ev-id="ev_e43ffbb5e7"
              className={`text-lg font-mono ${
              timer.remaining <= 10 && timer.remaining > 0 ?
              'text-error' :
              'text-foreground-secondary'}`
              }>

                    {formatTime(timer.remaining)}
                  </p>
                </div>
                <div data-ev-id="ev_ca80f93359" className="flex items-center gap-1">
                  <button data-ev-id="ev_8bfc1e93a6"
              onClick={() => toggleTimer(timer.id)}
              className="p-2 text-foreground-muted hover:text-foreground"
              aria-label={timer.isRunning ? 'Pause' : 'Resume'}>

                    {timer.isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button data-ev-id="ev_45c6b4345e"
              onClick={() => resetTimer(timer.id)}
              className="p-2 text-foreground-muted hover:text-foreground"
              aria-label="Reset timer">

                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button data-ev-id="ev_1b114865b3"
              onClick={() => removeTimer(timer.id)}
              className="p-2 text-foreground-muted hover:text-error"
              aria-label="Remove timer">

                    <X className="w-4 h-4" />
                  </button>
                </div>
              </Card>
          )}
          </div>
        }
      </div>

      {/* Navigation */}
      <div data-ev-id="ev_446dd396db" className="pb-safe border-t border-border bg-surface">
        <div data-ev-id="ev_687b8d77dd" className="flex items-center justify-between p-4">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}>

            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          {currentStep === totalSteps - 1 ?
          <Button
            onClick={() => {
              alert('Recipe complete! 🎉');
              navigate('/recipes');
            }}>

              <Check className="w-4 h-4" />
              Finish
            </Button> :

          <Button
            onClick={() => setCurrentStep(Math.min(totalSteps - 1, currentStep + 1))}>

              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          }
        </div>
      </div>

      {/* Ask SAVR button */}
      <div data-ev-id="ev_810bdaa676" className="fixed bottom-24 right-4">
        <button data-ev-id="ev_dbead448db"
        onClick={() => navigate('/chat')}
        className="w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary-hover transition-colors"
        aria-label="Ask SAVR about this step">

          <Sparkles className="w-5 h-5" />
        </button>
      </div>
    </div>);

}