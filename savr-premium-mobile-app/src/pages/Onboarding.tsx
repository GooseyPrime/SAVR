/**
 * SAVR Onboarding Page
 * Step-by-step onboarding: Welcome, Mode selection, Dietary preferences
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChefHat,
  Dog,
  Cat,
  Camera,
  Sparkles,
  Check,
  ArrowRight,
  User,
  ShieldAlert,
  Leaf,
  Wheat,
  Milk,
  Egg,
  Fish,
  Nut } from
'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LogoAnimated } from '@/components/brand/Logo';
import { useAppStore, type Diet } from '@/store/app-store';

interface Step {
  id: string;
  title: string;
  subtitle: string;
}

const steps: Step[] = [
{
  id: 'welcome',
  title: 'Welcome to SAVR',
  subtitle: 'Your AI-powered kitchen companion'
},
{
  id: 'mode',
  title: 'Who are you cooking for?',
  subtitle: 'Select your recipe mode'
},
{
  id: 'dietary',
  title: 'Dietary Preferences',
  subtitle: 'Help us personalize your experience'
},
{
  id: 'complete',
  title: 'You\'re all set!',
  subtitle: 'Let\'s start cooking'
}];


const modes = [
{ id: 'human' as const, icon: ChefHat, label: 'Human Recipes', desc: 'Meals for people' },
{ id: 'dog' as const, icon: Dog, label: 'Dog-Safe Recipes', desc: 'Canine-friendly meals' },
{ id: 'cat' as const, icon: Cat, label: 'Cat-Safe Recipes', desc: 'Feline-friendly meals' }];


const dietaryOptions: {id: Diet;label: string;icon: typeof Leaf;}[] = [
{ id: 'vegetarian', label: 'Vegetarian', icon: Leaf },
{ id: 'vegan', label: 'Vegan', icon: Leaf },
{ id: 'gluten-free', label: 'Gluten-Free', icon: Wheat },
{ id: 'dairy-free', label: 'Dairy-Free', icon: Milk },
{ id: 'nut-free', label: 'Nut-Free', icon: Nut },
{ id: 'keto', label: 'Keto', icon: Egg }];


export default function Onboarding() {
  const navigate = useNavigate();
  const { setRecipeMode, updatePreferences, completeOnboarding } = useAppStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedMode, setSelectedMode] = useState<'human' | 'dog' | 'cat'>('human');
  const [selectedDiets, setSelectedDiets] = useState<Diet[]>([]);

  const toggleDiet = (diet: Diet) => {
    setSelectedDiets((prev) =>
    prev.includes(diet) ? prev.filter((d) => d !== diet) : [...prev, diet]
    );
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Save preferences and complete
      setRecipeMode(selectedMode);
      updatePreferences({ diets: selectedDiets });
      completeOnboarding();
      navigate('/auth');
    }
  };

  const handleSkip = () => {
    setRecipeMode(selectedMode);
    completeOnboarding();
    navigate('/');
  };

  const renderStepContent = () => {
    switch (steps[currentStep].id) {
      case 'welcome':
        return (
          <div data-ev-id="ev_8f3bde18b1" className="flex flex-col items-center text-center">
            <div data-ev-id="ev_a6418bc513" className="mb-8">
              <LogoAnimated />
            </div>
            <div data-ev-id="ev_9c78d6180e" className="flex flex-col gap-4 max-w-xs">
              <div data-ev-id="ev_ef009d883e" className="flex items-center gap-4 text-left">
                <div data-ev-id="ev_143d4c7c8b" className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Camera className="w-6 h-6 text-primary" strokeWidth={1.5} />
                </div>
                <div data-ev-id="ev_f2fa1127bc">
                  <p data-ev-id="ev_3d0b1c53b7" className="font-medium text-foreground">Scan Ingredients</p>
                  <p data-ev-id="ev_0b9d61b055" className="text-sm text-foreground-secondary">AI-powered detection</p>
                </div>
              </div>
              <div data-ev-id="ev_867754cc41" className="flex items-center gap-4 text-left">
                <div data-ev-id="ev_ffc89e87f2" className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6 text-primary" strokeWidth={1.5} />
                </div>
                <div data-ev-id="ev_fbb5c09456">
                  <p data-ev-id="ev_c64726932b" className="font-medium text-foreground">Generate Recipes</p>
                  <p data-ev-id="ev_6856949eac" className="text-sm text-foreground-secondary">From your pantry</p>
                </div>
              </div>
              <div data-ev-id="ev_8b9c83929c" className="flex items-center gap-4 text-left">
                <div data-ev-id="ev_5f5b841354" className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <ChefHat className="w-6 h-6 text-primary" strokeWidth={1.5} />
                </div>
                <div data-ev-id="ev_38280a1641">
                  <p data-ev-id="ev_694c43e898" className="font-medium text-foreground">Cook with Confidence</p>
                  <p data-ev-id="ev_8a896dd3dd" className="text-sm text-foreground-secondary">Step-by-step guidance</p>
                </div>
              </div>
            </div>
          </div>);


      case 'mode':
        return (
          <div data-ev-id="ev_b0ade4cb49" className="flex flex-col gap-3">
            {modes.map(({ id, icon: Icon, label, desc }) =>
            <button data-ev-id="ev_e150c178b1"
            key={id}
            onClick={() => setSelectedMode(id)}
            className={`
                  flex items-center gap-4 p-4 rounded-xl border transition-all
                  ${selectedMode === id ?
            'border-primary bg-primary/10' :
            'border-border bg-surface hover:border-primary/30'}
                `
            }>

                <div data-ev-id="ev_3596517dd3" className={`
                  w-14 h-14 rounded-lg flex items-center justify-center transition-all
                  ${selectedMode === id ? 'bg-primary text-primary-foreground' : 'bg-surface-raised'}
                `}>
                  <Icon className="w-7 h-7" strokeWidth={1.5} />
                </div>
                <div data-ev-id="ev_406ddd7a50" className="flex-1 text-left">
                  <p data-ev-id="ev_503ddefd74" className="font-medium text-foreground">{label}</p>
                  <p data-ev-id="ev_e8aa331f4c" className="text-sm text-foreground-secondary">{desc}</p>
                </div>
                {selectedMode === id &&
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">

                    <Check className="w-4 h-4 text-primary-foreground" />
                  </motion.div>
              }
              </button>
            )}
            
            {/* Pet safety notice */}
            {selectedMode !== 'human' &&
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/20 rounded-lg mt-2">

                <ShieldAlert className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <p data-ev-id="ev_297ccd3c84" className="text-sm text-foreground-secondary">
                  Pet recipes are designed with their dietary needs in mind. Always consult your vet before changing your pet's diet.
                </p>
              </motion.div>
            }
          </div>);


      case 'dietary':
        return (
          <div data-ev-id="ev_95406ed7bf" className="flex flex-col gap-4">
            <p data-ev-id="ev_b0cdb355ef" className="text-sm text-foreground-secondary text-center mb-2">
              Select any that apply (you can change this later)
            </p>
            <div data-ev-id="ev_20bc1ab3c2" className="grid grid-cols-2 gap-3">
              {dietaryOptions.map(({ id, label, icon: Icon }) =>
              <button data-ev-id="ev_909234e850"
              key={id}
              onClick={() => toggleDiet(id)}
              className={`
                    flex items-center gap-3 p-3 rounded-lg border transition-all
                    ${selectedDiets.includes(id) ?
              'border-primary bg-primary/10' :
              'border-border bg-surface hover:border-primary/30'}
                  `
              }>

                  <Icon className={`w-5 h-5 ${selectedDiets.includes(id) ? 'text-primary' : 'text-foreground-muted'}`} strokeWidth={1.5} />
                  <span data-ev-id="ev_909ca5791a" className="text-sm font-medium text-foreground">{label}</span>
                  {selectedDiets.includes(id) &&
                <Check className="w-4 h-4 text-primary ml-auto" />
                }
                </button>
              )}
            </div>
            <button data-ev-id="ev_b18f8b3151"
            onClick={() => setSelectedDiets([])}
            className="text-sm text-foreground-muted hover:text-foreground transition-colors mt-2">

              Skip for now
            </button>
          </div>);


      case 'complete':
        return (
          <div data-ev-id="ev_68cf3f9c5f" className="flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">

              <Check className="w-10 h-10 text-primary" strokeWidth={2} />
            </motion.div>
            <p data-ev-id="ev_124f362b74" className="text-foreground-secondary max-w-xs">
              Your preferences are saved. Create an account to sync across devices, or continue as a guest.
            </p>
            <div data-ev-id="ev_411bcfa6cf" className="flex flex-col gap-3 w-full mt-6">
              <Button fullWidth onClick={() => {
                setRecipeMode(selectedMode);
                updatePreferences({ diets: selectedDiets });
                completeOnboarding();
                navigate('/auth');
              }}>
                <User className="w-4 h-4" />
                Create Account
              </Button>
              <Button variant="outline" fullWidth onClick={handleSkip}>
                Continue as Guest
              </Button>
              <p data-ev-id="ev_badc2561af" className="text-xs text-foreground-muted mt-2">
                Guest mode stores data locally on this device only
              </p>
            </div>
          </div>);


      default:
        return null;
    }
  };

  return (
    <div data-ev-id="ev_302d662539" className="min-h-screen bg-background flex flex-col">
      {/* Ambient glow */}
      <div data-ev-id="ev_2d6b662ea9" className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <div data-ev-id="ev_c8c0315280" className="pt-safe relative z-10">
        <div data-ev-id="ev_420afce9ce" className="flex items-center justify-between p-4">
          <div data-ev-id="ev_c53327ab2f" className="w-16" />
          {/* Progress dots */}
          <div data-ev-id="ev_5c6466eb48" className="flex gap-2">
            {steps.map((_, i) =>
            <div data-ev-id="ev_dc8341b960"
            key={i}
            className={`
                  w-2 h-2 rounded-full transition-all duration-300
                  ${i === currentStep ? 'bg-primary w-6' : i < currentStep ? 'bg-primary/50' : 'bg-border'}
                `} />

            )}
          </div>
          {currentStep < steps.length - 1 &&
          <button data-ev-id="ev_46b647b24a"
          onClick={handleSkip}
          className="text-sm text-foreground-muted hover:text-foreground transition-colors">

              Skip
            </button>
          }
          {currentStep === steps.length - 1 && <div data-ev-id="ev_560f9d20f5" className="w-16" />}
        </div>
      </div>

      {/* Content */}
      <div data-ev-id="ev_2e54697bae" className="flex-1 flex flex-col justify-center px-5 pb-8 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={steps[currentStep].id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>

            <div data-ev-id="ev_7aab645971" className="text-center mb-8">
              <h1 data-ev-id="ev_3fed2f9c19" className="text-2xl font-display font-medium text-foreground">
                {steps[currentStep].title}
              </h1>
              <p data-ev-id="ev_790c2e32e6" className="text-foreground-secondary mt-2">
                {steps[currentStep].subtitle}
              </p>
            </div>
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      {currentStep < steps.length - 1 &&
      <div data-ev-id="ev_6232fe359c" className="pb-safe relative z-10">
          <div data-ev-id="ev_9db9b5970b" className="p-4">
            <Button fullWidth size="lg" onClick={handleNext}>
              Continue
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      }
    </div>);

}