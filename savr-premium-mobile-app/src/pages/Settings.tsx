/**
 * SAVR Settings Page - Complete Implementation
 * All settings categories with proper destinations
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  ChefHat,
  Dog,
  Cat,
  Heart,
  Bell,
  Moon,
  Shield,
  CreditCard,
  FileText,
  HelpCircle,
  Info,
  Check,
  ChevronRight,
  ArrowLeft,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
  Sparkles,
  Zap,
  Brain,
  Clock,
  Utensils,
  Coffee,
  Sun,
  Cookie,
  Scale,
  Wallet,
  Globe,
  PawPrint,
  Plus,
  X as XIcon,
  Trash2 } from
'lucide-react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StorageLocationsManager } from '@/components/storage/StorageLocationsManager';
import { useAppStore, type RecipeMode, type Diet } from '@/store/app-store';
import { supabase } from '@/integrations/supabase/client';
import { useAISettings, AI_PROVIDERS, AI_MODELS, type AIProvider } from '@/hooks/use-ai-settings';

type SettingsTab =
'main' |
'storage' |
'mode' |
'dietary' |
'preferences' |
'mealtimes' |
'cuisine' |
'notifications' |
'appearance' |
'security' |
'subscription' |
'privacy' |
'help' |
'about' |
'ai';

const modeOptions: {id: RecipeMode;label: string;icon: typeof ChefHat;desc: string;}[] = [
{ id: 'human', label: 'Human Recipes', icon: ChefHat, desc: 'Standard meals for people' },
{ id: 'dog', label: 'Dog-Safe', icon: Dog, desc: 'Pet-safe recipes for dogs' },
{ id: 'cat', label: 'Cat-Safe', icon: Cat, desc: 'Pet-safe recipes for cats' }];


const dietOptions: {id: Diet;label: string;}[] = [
{ id: 'vegetarian', label: 'Vegetarian' },
{ id: 'vegan', label: 'Vegan' },
{ id: 'gluten-free', label: 'Gluten-Free' },
{ id: 'dairy-free', label: 'Dairy-Free' },
{ id: 'nut-free', label: 'Nut-Free' },
{ id: 'keto', label: 'Keto' },
{ id: 'paleo', label: 'Paleo' },
{ id: 'mediterranean', label: 'Mediterranean' },
{ id: 'low-sodium', label: 'Low Sodium' },
{ id: 'diabetic', label: 'Diabetic-Friendly' },
{ id: 'low-fodmap', label: 'Low FODMAP' }];

const cuisineOptions = [
'Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian', 'Thai', 'Vietnamese',
'Korean', 'Mediterranean', 'French', 'Greek', 'Middle Eastern', 'American',
'Southern', 'Cajun', 'Caribbean', 'Brazilian', 'Peruvian', 'Spanish', 'German',
'British', 'Irish', 'Ethiopian', 'Moroccan', 'Turkish', 'Filipino', 'Indonesian'];


const commonAllergies = [
'Peanuts', 'Tree Nuts', 'Milk', 'Eggs', 'Wheat', 'Soy', 'Fish', 'Shellfish',
'Sesame', 'Mustard', 'Celery', 'Lupin', 'Mollusks', 'Sulfites'];



export default function Settings() {
  const { preferences, updatePreferences, setRecipeMode, isAuthenticated } = useAppStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('main');
  const [isSaving, setIsSaving] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // AI Settings
  const { settings: aiSettings, isLoading: aiLoading, isSaving: aiSaving, updateSettings: updateAISettings, error: aiError } = useAISettings();
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('openrouter');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [aiSettingsInitialized, setAiSettingsInitialized] = useState(false);

  // Initialize AI settings from saved values when they load
  useEffect(() => {
    if (aiSettings && !aiSettingsInitialized) {
      if (aiSettings.preferred_provider) {
        setSelectedProvider(aiSettings.preferred_provider as AIProvider);
      }
      if (aiSettings.preferred_model) {
        setSelectedModel(aiSettings.preferred_model);
      }
      if (aiSettings.custom_temperature !== null && aiSettings.custom_temperature !== undefined) {
        setTemperature(aiSettings.custom_temperature);
      }
      setAiSettingsInitialized(true);
    }
  }, [aiSettings, aiSettingsInitialized]);

  // Preferences state
  const [newCuisine, setNewCuisine] = useState('');
  const [newAllergy, setNewAllergy] = useState('');
  const [showCuisineDropdown, setShowCuisineDropdown] = useState(false);
  const [showAllergyDropdown, setShowAllergyDropdown] = useState(false);

  const handleModeChange = useCallback(
    (mode: RecipeMode) => {
      setRecipeMode(mode);
    },
    [setRecipeMode]
  );

  const handleDietToggle = useCallback(
    (diet: Diet) => {
      const current = preferences.diets || [];
      const updated = current.includes(diet) ?
      current.filter((d) => d !== diet) :
      [...current, diet];
      updatePreferences({ diets: updated });
    },
    [preferences.diets, updatePreferences]
  );

  const handleAddCuisine = useCallback(
    (cuisine: string) => {
      if (!cuisine.trim()) return;
      const current = preferences.cuisinePreferences || [];
      if (!current.includes(cuisine)) {
        updatePreferences({ cuisinePreferences: [...current, cuisine] });
      }
      setNewCuisine('');
      setShowCuisineDropdown(false);
    },
    [preferences.cuisinePreferences, updatePreferences]
  );

  const handleRemoveCuisine = useCallback(
    (cuisine: string) => {
      const current = preferences.cuisinePreferences || [];
      updatePreferences({ cuisinePreferences: current.filter((c) => c !== cuisine) });
    },
    [preferences.cuisinePreferences, updatePreferences]
  );

  const handleAddAllergy = useCallback(
    (allergy: string) => {
      if (!allergy.trim()) return;
      const current = preferences.allergies || [];
      if (!current.includes(allergy)) {
        updatePreferences({ allergies: [...current, allergy] });
      }
      setNewAllergy('');
      setShowAllergyDropdown(false);
    },
    [preferences.allergies, updatePreferences]
  );

  const handleRemoveAllergy = useCallback(
    (allergy: string) => {
      const current = preferences.allergies || [];
      updatePreferences({ allergies: current.filter((a) => a !== allergy) });
    },
    [preferences.allergies, updatePreferences]
  );

  const handleMealTimeChange = useCallback(
    (meal: 'breakfast' | 'lunch' | 'dinner' | 'snack', time: string) => {
      const current = preferences.mealTimes || {
        breakfast: '07:00',
        lunch: '12:00',
        dinner: '18:00',
        snack: '15:00'
      };
      updatePreferences({ mealTimes: { ...current, [meal]: time } });
    },
    [preferences.mealTimes, updatePreferences]
  );

  const handlePasswordChange = async () => {
    if (!supabase) return;
    setPasswordError('');

    if (passwordForm.new.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.new
      });
      if (error) throw error;
      setShowPasswordChange(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
      alert('Password updated successfully');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setIsSaving(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'storage':
        return <StorageLocationsManager />;

      case 'mode':
        return (
          <div data-ev-id="ev_55828a0765" className="p-4 flex flex-col gap-3">
            <p data-ev-id="ev_4115217acd" className="text-sm text-foreground-secondary mb-2">
              Select the type of recipes you want to create and browse.
            </p>
            {modeOptions.map(({ id, label, icon: Icon, desc }) =>
            <Card
              key={id}
              variant="interactive"
              padding="sm"
              className={`cursor-pointer ${
              preferences.recipeMode === id ? 'border-primary bg-primary/5' : ''}`
              }
              onClick={() => handleModeChange(id)}>

                <div data-ev-id="ev_6feefad7db" className="flex items-center gap-4">
                  <div data-ev-id="ev_674a64a00b"
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                preferences.recipeMode === id ?
                'bg-primary text-primary-foreground' :
                'bg-muted text-foreground-muted'}`
                }>

                    <Icon className="w-5 h-5" />
                  </div>
                  <div data-ev-id="ev_f29c82c094" className="flex-1">
                    <p data-ev-id="ev_a8ca8481fc" className="font-medium text-foreground">{label}</p>
                    <p data-ev-id="ev_c4a3eb7447" className="text-sm text-foreground-muted">{desc}</p>
                  </div>
                  {preferences.recipeMode === id &&
                <Check className="w-5 h-5 text-primary" />
                }
                </div>
              </Card>
            )}
            {(preferences.recipeMode === 'dog' || preferences.recipeMode === 'cat') &&
            <Card className="bg-warning/10 border-warning/20 mt-2">
                <div data-ev-id="ev_628210206a" className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                  <div data-ev-id="ev_d8ee87d795">
                    <p data-ev-id="ev_1db7dcafd5" className="text-sm text-foreground font-medium">Pet Safety Notice</p>
                    <p data-ev-id="ev_7228a933aa" className="text-xs text-foreground-secondary mt-1">
                      Always verify ingredients are safe for your specific pet. Consult your
                      veterinarian before making dietary changes.
                    </p>
                  </div>
                </div>
              </Card>
            }
          </div>);


      case 'dietary':
        return (
          <div data-ev-id="ev_6131eb11b2" className="p-4">
            <p data-ev-id="ev_5e86e19ab6" className="text-sm text-foreground-secondary mb-4">
              Select your dietary preferences. AI-generated recipes will respect these.
            </p>
            <div data-ev-id="ev_9b8f67a800" className="flex flex-wrap gap-2">
              {dietOptions.map(({ id, label }) => {
                const isSelected = preferences.diets?.includes(id);
                return (
                  <button data-ev-id="ev_48399e24d4"
                  key={id}
                  onClick={() => handleDietToggle(id)}
                  className={`
                      px-4 py-2 rounded-[var(--radius-full)] border text-sm
                      transition-all min-h-[44px]
                      ${isSelected ?
                  'bg-primary text-primary-foreground border-primary' :
                  'bg-surface border-border text-foreground hover:border-primary/50'}
                    `}>

                    {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                    {label}
                  </button>);

              })}
            </div>
          </div>);


      case 'preferences':
        return (
          <div data-ev-id="ev_7bad2c51db" className="p-4 flex flex-col gap-4">
            {/* Quick links to sub-preferences */}
            <Card
              variant="interactive"
              padding="sm"
              className="cursor-pointer"
              onClick={() => setActiveTab('mealtimes')}>

              <div data-ev-id="ev_be0797a8c2" className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary" />
                <div data-ev-id="ev_7a7dd79c12" className="flex-1">
                  <p data-ev-id="ev_c06e45d329" className="font-medium text-foreground">Meal Times</p>
                  <p data-ev-id="ev_905a840334" className="text-sm text-foreground-muted">Set your preferred meal schedule</p>
                </div>
                <ChevronRight className="w-4 h-4 text-foreground-muted" />
              </div>
            </Card>

            <Card
              variant="interactive"
              padding="sm"
              className="cursor-pointer"
              onClick={() => setActiveTab('cuisine')}>

              <div data-ev-id="ev_7814cd726e" className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-citrus" />
                <div data-ev-id="ev_87aaa0eb53" className="flex-1">
                  <p data-ev-id="ev_00a54b6db3" className="font-medium text-foreground">Cuisine Preferences</p>
                  <p data-ev-id="ev_06ed89100d" className="text-sm text-foreground-muted">
                    {(preferences.cuisinePreferences?.length || 0) > 0 ?
                    `${preferences.cuisinePreferences?.length} cuisines selected` :
                    'Select your favorite cuisines'
                    }
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-foreground-muted" />
              </div>
            </Card>

            <Card
              variant="interactive"
              padding="sm"
              className="cursor-pointer"
              onClick={() => setActiveTab('dietary')}>

              <div data-ev-id="ev_e0b06c393c" className="flex items-center gap-3">
                <Heart className="w-5 h-5 text-peach" />
                <div data-ev-id="ev_2dce6c3682" className="flex-1">
                  <p data-ev-id="ev_1d622c71ae" className="font-medium text-foreground">Dietary Restrictions</p>
                  <p data-ev-id="ev_364aa5c4c9" className="text-sm text-foreground-muted">
                    {(preferences.diets?.length || 0) > 0 ?
                    `${preferences.diets?.length} restrictions set` :
                    'Set dietary needs'
                    }
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-foreground-muted" />
              </div>
            </Card>

            {/* Cooking Settings */}
            <div data-ev-id="ev_cffbfc2276" className="mt-2">
              <h3 data-ev-id="ev_13b87f26ba" className="text-sm font-medium text-foreground-secondary mb-3 uppercase tracking-wider">Cooking Settings</h3>
              
              <Card padding="sm" className="mb-3">
                <div data-ev-id="ev_8c70c4c6cc" className="flex items-center justify-between mb-2">
                  <div data-ev-id="ev_40ef1abfab" className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-foreground-muted" />
                    <span data-ev-id="ev_a24f700c9b" className="text-foreground">Default Servings</span>
                  </div>
                  <select data-ev-id="ev_3769c9b15a"
                  value={preferences.defaultServings || 4}
                  onChange={(e) => updatePreferences({ defaultServings: parseInt(e.target.value) })}
                  className="bg-surface border border-border rounded px-3 py-2 text-foreground min-h-[44px]">

                    {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((n) =>
                    <option data-ev-id="ev_8576a61660" key={n} value={n}>{n} {n === 1 ? 'serving' : 'servings'}</option>
                    )}
                  </select>
                </div>
              </Card>

              <Card padding="sm" className="mb-3">
                <div data-ev-id="ev_7726b80b18" className="flex items-center justify-between mb-2">
                  <div data-ev-id="ev_2be8003506" className="flex items-center gap-2">
                    <ChefHat className="w-4 h-4 text-foreground-muted" />
                    <span data-ev-id="ev_86a50ef767" className="text-foreground">Cooking Skill</span>
                  </div>
                  <select data-ev-id="ev_dcb41cc499"
                  value={preferences.cookingSkillLevel || 'intermediate'}
                  onChange={(e) => updatePreferences({ cookingSkillLevel: e.target.value as 'beginner' | 'intermediate' | 'advanced' })}
                  className="bg-surface border border-border rounded px-3 py-2 text-foreground min-h-[44px]">

                    <option data-ev-id="ev_95fc02931a" value="beginner">Beginner</option>
                    <option data-ev-id="ev_14a237aeda" value="intermediate">Intermediate</option>
                    <option data-ev-id="ev_bb7c3c12bc" value="advanced">Advanced</option>
                  </select>
                </div>
              </Card>

              <Card padding="sm" className="mb-3">
                <div data-ev-id="ev_05bcd84f8a" className="flex items-center justify-between mb-2">
                  <div data-ev-id="ev_e3b1e82506" className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-foreground-muted" />
                    <span data-ev-id="ev_b3eedc019e" className="text-foreground">Budget Level</span>
                  </div>
                  <select data-ev-id="ev_54fcc6531f"
                  value={preferences.budgetLevel || 'moderate'}
                  onChange={(e) => updatePreferences({ budgetLevel: e.target.value as 'budget' | 'moderate' | 'premium' })}
                  className="bg-surface border border-border rounded px-3 py-2 text-foreground min-h-[44px]">

                    <option data-ev-id="ev_aaa058ea9c" value="budget">Budget-Friendly</option>
                    <option data-ev-id="ev_68ad16ae49" value="moderate">Moderate</option>
                    <option data-ev-id="ev_936bf8d37d" value="premium">Premium</option>
                  </select>
                </div>
              </Card>

              <Card padding="sm">
                <div data-ev-id="ev_c95ecf8cb2" className="flex items-center justify-between">
                  <div data-ev-id="ev_b3d251cc31" className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-foreground-muted" />
                    <span data-ev-id="ev_b761a738f7" className="text-foreground">Measurement System</span>
                  </div>
                  <select data-ev-id="ev_02bc1203f2"
                  value={preferences.measurementSystem || 'imperial'}
                  onChange={(e) => updatePreferences({ measurementSystem: e.target.value as 'metric' | 'imperial' })}
                  className="bg-surface border border-border rounded px-3 py-2 text-foreground min-h-[44px]">

                    <option data-ev-id="ev_202d4c25d4" value="imperial">Imperial (cups, oz)</option>
                    <option data-ev-id="ev_a45f27fcb7" value="metric">Metric (g, ml)</option>
                  </select>
                </div>
              </Card>
            </div>

            {/* Pet Profile (shown only in pet modes) */}
            {(preferences.recipeMode === 'dog' || preferences.recipeMode === 'cat') &&
            <div data-ev-id="ev_beca713ca1" className="mt-2">
                <h3 data-ev-id="ev_9837bf213b" className="text-sm font-medium text-foreground-secondary mb-3 uppercase tracking-wider flex items-center gap-2">
                  <PawPrint className="w-4 h-4" />
                  Pet Profile
                </h3>
                
                <Card padding="sm">
                  <div data-ev-id="ev_2194164f8c" className="flex flex-col gap-4">
                    <div data-ev-id="ev_09128a416a">
                      <label data-ev-id="ev_412bf62613" className="text-sm text-foreground-muted mb-1 block">Pet Name</label>
                      <Input
                      value={preferences.petName || ''}
                      onChange={(e) => updatePreferences({ petName: e.target.value })}
                      placeholder={`Your ${preferences.recipeMode}'s name`} />

                    </div>
                    <div data-ev-id="ev_568b61af2d" className="flex gap-3">
                      <div data-ev-id="ev_734d28ad05" className="flex-1">
                        <label data-ev-id="ev_126898d264" className="text-sm text-foreground-muted mb-1 block">Weight</label>
                        <Input
                        type="number"
                        value={preferences.petWeight || ''}
                        onChange={(e) => updatePreferences({ petWeight: parseFloat(e.target.value) || undefined })}
                        placeholder="Weight" />

                      </div>
                      <div data-ev-id="ev_e328582a58" className="w-24">
                        <label data-ev-id="ev_decf275b59" className="text-sm text-foreground-muted mb-1 block">Unit</label>
                        <select data-ev-id="ev_923b64de8c"
                      value={preferences.petWeightUnit || 'lbs'}
                      onChange={(e) => updatePreferences({ petWeightUnit: e.target.value as 'kg' | 'lbs' })}
                      className="w-full bg-surface border border-border rounded px-3 py-2 text-foreground min-h-[44px]">

                          <option data-ev-id="ev_c7544f09df" value="lbs">lbs</option>
                          <option data-ev-id="ev_484141e546" value="kg">kg</option>
                        </select>
                      </div>
                    </div>
                    <p data-ev-id="ev_e81be1a71b" className="text-xs text-foreground-muted">
                      Weight helps calculate appropriate portion sizes for your {preferences.recipeMode}.
                    </p>
                  </div>
                </Card>
              </div>
            }
          </div>);


      case 'mealtimes':
        return (
          <div data-ev-id="ev_647dc2362f" className="p-4 flex flex-col gap-4">
            <p data-ev-id="ev_1177e63f22" className="text-sm text-foreground-secondary">
              Set your preferred meal times. These will be used for meal plan reminders and scheduling.
            </p>

            <Card padding="sm">
              <div data-ev-id="ev_7006ba7508" className="flex items-center justify-between">
                <div data-ev-id="ev_933fb092fd" className="flex items-center gap-3">
                  <div data-ev-id="ev_6f19aa5fc8" className="w-10 h-10 rounded-full bg-citrus/10 flex items-center justify-center">
                    <Coffee className="w-5 h-5 text-citrus" />
                  </div>
                  <div data-ev-id="ev_68dbd3f398">
                    <p data-ev-id="ev_84595a921f" className="font-medium text-foreground">Breakfast</p>
                    <p data-ev-id="ev_b22c9ffde3" className="text-xs text-foreground-muted">Morning meal</p>
                  </div>
                </div>
                <input data-ev-id="ev_f993309bce"
                type="time"
                value={preferences.mealTimes?.breakfast || '07:00'}
                onChange={(e) => handleMealTimeChange('breakfast', e.target.value)}
                className="bg-surface border border-border rounded px-3 py-2 text-foreground min-h-[44px]" />

              </div>
            </Card>

            <Card padding="sm">
              <div data-ev-id="ev_d77476445d" className="flex items-center justify-between">
                <div data-ev-id="ev_474e65afab" className="flex items-center gap-3">
                  <div data-ev-id="ev_d02014c49f" className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sun className="w-5 h-5 text-primary" />
                  </div>
                  <div data-ev-id="ev_b0d7cf1fb6">
                    <p data-ev-id="ev_547346f3a0" className="font-medium text-foreground">Lunch</p>
                    <p data-ev-id="ev_2df25ba065" className="text-xs text-foreground-muted">Midday meal</p>
                  </div>
                </div>
                <input data-ev-id="ev_6d2b7a2b53"
                type="time"
                value={preferences.mealTimes?.lunch || '12:00'}
                onChange={(e) => handleMealTimeChange('lunch', e.target.value)}
                className="bg-surface border border-border rounded px-3 py-2 text-foreground min-h-[44px]" />

              </div>
            </Card>

            <Card padding="sm">
              <div data-ev-id="ev_6bb5f3f53e" className="flex items-center justify-between">
                <div data-ev-id="ev_2f58974203" className="flex items-center gap-3">
                  <div data-ev-id="ev_c17689ba2d" className="w-10 h-10 rounded-full bg-mint/10 flex items-center justify-center">
                    <Moon className="w-5 h-5 text-mint" />
                  </div>
                  <div data-ev-id="ev_a890cd73be">
                    <p data-ev-id="ev_81128fe9e8" className="font-medium text-foreground">Dinner</p>
                    <p data-ev-id="ev_45ca34e40d" className="text-xs text-foreground-muted">Evening meal</p>
                  </div>
                </div>
                <input data-ev-id="ev_b036951a07"
                type="time"
                value={preferences.mealTimes?.dinner || '18:00'}
                onChange={(e) => handleMealTimeChange('dinner', e.target.value)}
                className="bg-surface border border-border rounded px-3 py-2 text-foreground min-h-[44px]" />

              </div>
            </Card>

            <Card padding="sm">
              <div data-ev-id="ev_e5b5a1ba95" className="flex items-center justify-between">
                <div data-ev-id="ev_a2b3993f89" className="flex items-center gap-3">
                  <div data-ev-id="ev_27e508fee1" className="w-10 h-10 rounded-full bg-peach/10 flex items-center justify-center">
                    <Cookie className="w-5 h-5 text-peach" />
                  </div>
                  <div data-ev-id="ev_70ffabe30a">
                    <p data-ev-id="ev_c9df05a27e" className="font-medium text-foreground">Snack</p>
                    <p data-ev-id="ev_5f67037829" className="text-xs text-foreground-muted">Between meals</p>
                  </div>
                </div>
                <input data-ev-id="ev_85e370fe7e"
                type="time"
                value={preferences.mealTimes?.snack || '15:00'}
                onChange={(e) => handleMealTimeChange('snack', e.target.value)}
                className="bg-surface border border-border rounded px-3 py-2 text-foreground min-h-[44px]" />

              </div>
            </Card>

            <Card className="bg-muted/30 border-dashed mt-2">
              <div data-ev-id="ev_2b51f8fcbf" className="flex gap-3">
                <Info className="w-5 h-5 text-foreground-muted flex-shrink-0" />
                <p data-ev-id="ev_843ef22644" className="text-sm text-foreground-secondary">
                  Meal times are used for meal plan notifications and to suggest appropriate recipes based on time of day.
                </p>
              </div>
            </Card>
          </div>);


      case 'cuisine':
        return (
          <div data-ev-id="ev_5eaa0e26e7" className="p-4 flex flex-col gap-4">
            <p data-ev-id="ev_a9ad27b832" className="text-sm text-foreground-secondary">
              Select your favorite cuisines. AI-generated recipes will prioritize these styles.
            </p>

            {/* Current selections */}
            {(preferences.cuisinePreferences?.length || 0) > 0 &&
            <div data-ev-id="ev_95e52c9916">
                <h4 data-ev-id="ev_a20b8bec75" className="text-xs text-foreground-muted uppercase tracking-wider mb-2">Your Favorites</h4>
                <div data-ev-id="ev_86ae7c6eb6" className="flex flex-wrap gap-2">
                  {(preferences.cuisinePreferences || []).map((cuisine) =>
                <span data-ev-id="ev_e98a9e321f"
                key={cuisine}
                className="inline-flex items-center gap-1 px-3 py-2 bg-primary/10 border border-primary/20 rounded-full text-sm text-primary">

                      {cuisine}
                      <button data-ev-id="ev_aa63e541ef"
                  onClick={() => handleRemoveCuisine(cuisine)}
                  className="ml-1 hover:text-danger min-w-[24px] min-h-[24px] flex items-center justify-center"
                  aria-label={`Remove ${cuisine}`}>

                        <XIcon className="w-3 h-3" />
                      </button>
                    </span>
                )}
                </div>
              </div>
            }

            {/* Add new cuisine */}
            <div data-ev-id="ev_35dee7f4aa">
              <h4 data-ev-id="ev_85dc8f1a87" className="text-xs text-foreground-muted uppercase tracking-wider mb-2">Add Cuisine</h4>
              <div data-ev-id="ev_e1f03fadcc" className="relative">
                <div data-ev-id="ev_8446fadbf9" className="flex gap-2">
                  <Input
                    value={newCuisine}
                    onChange={(e) => {
                      setNewCuisine(e.target.value);
                      setShowCuisineDropdown(true);
                    }}
                    onFocus={() => setShowCuisineDropdown(true)}
                    placeholder="Type or select cuisine..."
                    className="flex-1" />

                  <Button
                    onClick={() => handleAddCuisine(newCuisine)}
                    disabled={!newCuisine.trim()}
                    size="sm">

                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                
                {showCuisineDropdown &&
                <div data-ev-id="ev_203a0a9de1" className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                    {cuisineOptions.
                  filter((c) =>
                  c.toLowerCase().includes(newCuisine.toLowerCase()) &&
                  !(preferences.cuisinePreferences || []).includes(c)
                  ).
                  slice(0, 8).
                  map((cuisine) =>
                  <button data-ev-id="ev_0a4199edaa"
                  key={cuisine}
                  onClick={() => handleAddCuisine(cuisine)}
                  className="w-full text-left px-4 py-3 hover:bg-muted text-foreground min-h-[44px]">

                          {cuisine}
                        </button>
                  )
                  }
                    {newCuisine.trim() && !cuisineOptions.includes(newCuisine) &&
                  <button data-ev-id="ev_4be19553e5"
                  onClick={() => handleAddCuisine(newCuisine)}
                  className="w-full text-left px-4 py-3 hover:bg-muted text-primary border-t border-border min-h-[44px]">

                        <Plus className="w-4 h-4 inline mr-2" />
                        Add "{newCuisine}"
                      </button>
                  }
                  </div>
                }
              </div>
            </div>

            {/* Allergies section */}
            <div data-ev-id="ev_1f2facf2a6" className="mt-4 pt-4 border-t border-border">
              <h4 data-ev-id="ev_0dc415d033" className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-danger" />
                Food Allergies
              </h4>
              <p data-ev-id="ev_c3e3167c63" className="text-xs text-foreground-muted mb-3">
                Recipes will avoid these ingredients.
              </p>

              {/* Current allergies */}
              {(preferences.allergies?.length || 0) > 0 &&
              <div data-ev-id="ev_e3800f9a93" className="flex flex-wrap gap-2 mb-3">
                  {(preferences.allergies || []).map((allergy) =>
                <span data-ev-id="ev_08a569bb05"
                key={allergy}
                className="inline-flex items-center gap-1 px-3 py-2 bg-danger/10 border border-danger/20 rounded-full text-sm text-danger">

                      {allergy}
                      <button data-ev-id="ev_0b18575f84"
                  onClick={() => handleRemoveAllergy(allergy)}
                  className="ml-1 hover:text-danger min-w-[24px] min-h-[24px] flex items-center justify-center"
                  aria-label={`Remove ${allergy} allergy`}>

                        <XIcon className="w-3 h-3" />
                      </button>
                    </span>
                )}
                </div>
              }

              {/* Add allergy */}
              <div data-ev-id="ev_fe7eae052c" className="relative">
                <div data-ev-id="ev_279552c209" className="flex gap-2">
                  <Input
                    value={newAllergy}
                    onChange={(e) => {
                      setNewAllergy(e.target.value);
                      setShowAllergyDropdown(true);
                    }}
                    onFocus={() => setShowAllergyDropdown(true)}
                    placeholder="Type or select allergy..."
                    className="flex-1" />

                  <Button
                    onClick={() => handleAddAllergy(newAllergy)}
                    disabled={!newAllergy.trim()}
                    size="sm"
                    variant="danger">

                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                
                {showAllergyDropdown &&
                <div data-ev-id="ev_67d28c4e44" className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                    {commonAllergies.
                  filter((a) =>
                  a.toLowerCase().includes(newAllergy.toLowerCase()) &&
                  !(preferences.allergies || []).includes(a)
                  ).
                  slice(0, 8).
                  map((allergy) =>
                  <button data-ev-id="ev_c26e15b76d"
                  key={allergy}
                  onClick={() => handleAddAllergy(allergy)}
                  className="w-full text-left px-4 py-3 hover:bg-muted text-foreground min-h-[44px]">

                          {allergy}
                        </button>
                  )
                  }
                    {newAllergy.trim() && !commonAllergies.includes(newAllergy) &&
                  <button data-ev-id="ev_d069306105"
                  onClick={() => handleAddAllergy(newAllergy)}
                  className="w-full text-left px-4 py-3 hover:bg-muted text-danger border-t border-border min-h-[44px]">

                        <Plus className="w-4 h-4 inline mr-2" />
                        Add "{newAllergy}"
                      </button>
                  }
                  </div>
                }
              </div>
            </div>
          </div>);


      case 'notifications':
        return (
          <div data-ev-id="ev_68f4f4a677" className="p-4 flex flex-col gap-4">
            <p data-ev-id="ev_bbb2e40007" className="text-sm text-foreground-secondary">
              Manage when and how SAVR notifies you.
            </p>
            <Card padding="sm">
              <div data-ev-id="ev_b3fffe42c9" className="flex items-center justify-between">
                <div data-ev-id="ev_c0f5a28ea0">
                  <p data-ev-id="ev_afa1f36ae7" className="font-medium text-foreground">Expiration Alerts</p>
                  <p data-ev-id="ev_d7ac11911b" className="text-sm text-foreground-muted">Items expiring soon</p>
                </div>
                <input data-ev-id="ev_7fe1c5dbe3"
                type="checkbox"
                defaultChecked
                className="w-5 h-5 accent-primary" />

              </div>
            </Card>
            <Card padding="sm">
              <div data-ev-id="ev_fecc4ebe0d" className="flex items-center justify-between">
                <div data-ev-id="ev_022864fcc7">
                  <p data-ev-id="ev_5e5f544e08" className="font-medium text-foreground">Meal Plan Reminders</p>
                  <p data-ev-id="ev_1f76c88f49" className="text-sm text-foreground-muted">Daily meal suggestions</p>
                </div>
                <input data-ev-id="ev_79472caa14" type="checkbox" className="w-5 h-5 accent-primary" />
              </div>
            </Card>
            <Card padding="sm">
              <div data-ev-id="ev_5d89917797" className="flex items-center justify-between">
                <div data-ev-id="ev_fd69e2ca40">
                  <p data-ev-id="ev_3496a58932" className="font-medium text-foreground">Recipe Tips</p>
                  <p data-ev-id="ev_0cd1b49fdd" className="text-sm text-foreground-muted">Cooking suggestions</p>
                </div>
                <input data-ev-id="ev_cfaf4daada" type="checkbox" className="w-5 h-5 accent-primary" />
              </div>
            </Card>
          </div>);


      case 'appearance':
        return (
          <div data-ev-id="ev_38d67b8a39" className="p-4 flex flex-col gap-4">
            <Card padding="sm">
              <div data-ev-id="ev_5054a9ff40" className="flex items-center justify-between">
                <div data-ev-id="ev_489152a38a" className="flex items-center gap-3">
                  <Moon className="w-5 h-5 text-foreground-muted" />
                  <div data-ev-id="ev_2ef1d11774">
                    <p data-ev-id="ev_2d3bc34ce8" className="font-medium text-foreground">Dark Mode</p>
                    <p data-ev-id="ev_3b8e5c8d85" className="text-sm text-foreground-muted">Currently active</p>
                  </div>
                </div>
                <input data-ev-id="ev_82386c5b25" type="checkbox" defaultChecked className="w-5 h-5 accent-primary" />
              </div>
            </Card>
            <p data-ev-id="ev_f6b4958d94" className="text-xs text-foreground-muted text-center">
              SAVR is designed for dark mode. Light mode coming soon.
            </p>
          </div>);


      case 'security':
        return (
          <div data-ev-id="ev_1497ffe5f1" className="p-4 flex flex-col gap-4">
            {!isAuthenticated ?
            <Card className="bg-warning/10 border-warning/20">
                <div data-ev-id="ev_0bf69ce002" className="flex gap-3">
                  <Shield className="w-5 h-5 text-warning flex-shrink-0" />
                  <div data-ev-id="ev_470739aec9">
                    <p data-ev-id="ev_335d46e046" className="text-sm text-foreground font-medium">Guest Mode</p>
                    <p data-ev-id="ev_89962c906f" className="text-xs text-foreground-secondary mt-1">
                      Sign in to access security settings and sync your data.
                    </p>
                  </div>
                </div>
              </Card> :

            <>
                <Card padding="sm">
                  <div data-ev-id="ev_3620a34d82"
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowPasswordChange(!showPasswordChange)}>

                    <div data-ev-id="ev_a98eb2916c" className="flex items-center gap-3">
                      <Lock className="w-5 h-5 text-foreground-muted" />
                      <div data-ev-id="ev_19df4594a7">
                        <p data-ev-id="ev_b1d4488459" className="font-medium text-foreground">Change Password</p>
                        <p data-ev-id="ev_587d85f2e3" className="text-sm text-foreground-muted">Update your password</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-foreground-muted" />
                  </div>
                </Card>

                <AnimatePresence>
                  {showPasswordChange &&
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden">

                      <Card className="flex flex-col gap-3">
                        <div data-ev-id="ev_a9151a27ff" className="relative">
                          <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="New password"
                        value={passwordForm.new}
                        onChange={(e) =>
                        setPasswordForm((p) => ({ ...p, new: e.target.value }))
                        } />

                          <button data-ev-id="ev_66f41a1c0e"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted">

                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Confirm new password"
                      value={passwordForm.confirm}
                      onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, confirm: e.target.value }))
                      } />

                        {passwordError &&
                    <p data-ev-id="ev_e40263bc22" className="text-sm text-error">{passwordError}</p>
                    }
                        <Button onClick={handlePasswordChange} disabled={isSaving}>
                          {isSaving ?
                      <Loader2 className="w-4 h-4 animate-spin" /> :

                      'Update Password'
                      }
                        </Button>
                      </Card>
                    </motion.div>
                }
                </AnimatePresence>
              </>
            }
          </div>);


      case 'subscription':
        return (
          <div data-ev-id="ev_ffbfb603a9" className="p-4 flex flex-col gap-4">
            <Card className="bg-primary/5 border-primary/20">
              <div data-ev-id="ev_f394da1b3b" className="text-center py-4">
                <p data-ev-id="ev_a8b33c1585" className="text-xs text-foreground-muted uppercase tracking-wider mb-2">
                  Current Plan
                </p>
                <p data-ev-id="ev_c622fed59d" className="text-2xl font-display font-light text-foreground mb-1">
                  {isAuthenticated ? 'Free' : 'Guest'}
                </p>
                <p data-ev-id="ev_11ffb72a56" className="text-sm text-foreground-secondary">
                  {isAuthenticated ?
                  'Basic features with cloud sync' :
                  'Local storage only'}
                </p>
              </div>
            </Card>
            <p data-ev-id="ev_0bf5355ecb" className="text-xs text-foreground-muted text-center">
              Premium features coming soon.
            </p>
          </div>);


      case 'privacy':
        return (
          <div data-ev-id="ev_7e747375f5" className="p-4 flex flex-col gap-4">
            <p data-ev-id="ev_9bf2e06007" className="text-sm text-foreground-secondary">
              Manage your data and privacy preferences.
            </p>
            <Card padding="sm">
              <div data-ev-id="ev_df60413b48" className="flex items-center justify-between">
                <div data-ev-id="ev_fd52e1bfff">
                  <p data-ev-id="ev_5f1beefec4" className="font-medium text-foreground">Analytics</p>
                  <p data-ev-id="ev_a532f04d0a" className="text-sm text-foreground-muted">Help improve SAVR</p>
                </div>
                <input data-ev-id="ev_b59d63bf5d" type="checkbox" defaultChecked className="w-5 h-5 accent-primary" />
              </div>
            </Card>
            <Card padding="sm">
              <div data-ev-id="ev_b7e506b156" className="flex items-center justify-between">
                <div data-ev-id="ev_4f686dfaff">
                  <p data-ev-id="ev_c5d4865ef1" className="font-medium text-foreground">Personalization</p>
                  <p data-ev-id="ev_9ee9f00ab1" className="text-sm text-foreground-muted">Better recommendations</p>
                </div>
                <input data-ev-id="ev_e4533b75dd" type="checkbox" defaultChecked className="w-5 h-5 accent-primary" />
              </div>
            </Card>
          </div>);


      case 'help':
        return (
          <div data-ev-id="ev_ad7d6461ed" className="p-4 flex flex-col gap-4">
            <Card variant="interactive" padding="sm" className="cursor-pointer">
              <div data-ev-id="ev_4e6dba0ec5" className="flex items-center gap-3">
                <HelpCircle className="w-5 h-5 text-foreground-muted" />
                <div data-ev-id="ev_d0365c9ba5" className="flex-1">
                  <p data-ev-id="ev_844b9741a8" className="font-medium text-foreground">FAQ</p>
                  <p data-ev-id="ev_09c4aa9165" className="text-sm text-foreground-muted">Common questions</p>
                </div>
                <ChevronRight className="w-4 h-4 text-foreground-muted" />
              </div>
            </Card>
            <Card variant="interactive" padding="sm" className="cursor-pointer">
              <div data-ev-id="ev_ab86631c9d" className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-foreground-muted" />
                <div data-ev-id="ev_7d939515bb" className="flex-1">
                  <p data-ev-id="ev_75f6f10543" className="font-medium text-foreground">Contact Support</p>
                  <p data-ev-id="ev_b1056faa0d" className="text-sm text-foreground-muted">Get help</p>
                </div>
                <ChevronRight className="w-4 h-4 text-foreground-muted" />
              </div>
            </Card>
            <Card variant="interactive" padding="sm" className="cursor-pointer">
              <div data-ev-id="ev_5737664239" className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-foreground-muted" />
                <div data-ev-id="ev_09787abd88" className="flex-1">
                  <p data-ev-id="ev_ebaf356ada" className="font-medium text-foreground">Terms of Service</p>
                  <p data-ev-id="ev_4893c81e85" className="text-sm text-foreground-muted">Legal info</p>
                </div>
                <ChevronRight className="w-4 h-4 text-foreground-muted" />
              </div>
            </Card>
          </div>);


      case 'ai':
        return (
          <div data-ev-id="ev_eaaea49dfa" className="p-4 flex flex-col gap-4">
            {/* Header with gradient accent */}
            <div data-ev-id="ev_90b486b097" className="bg-gradient-to-br from-primary/10 to-mint/10 rounded-xl p-4 border border-primary/20">
              <div data-ev-id="ev_62d8867c29" className="flex items-center gap-3 mb-2">
                <div data-ev-id="ev_2729030f2b" className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div data-ev-id="ev_0d6f20a196">
                  <h3 data-ev-id="ev_1eeee7cf0e" className="font-medium text-foreground">AI-Powered Features</h3>
                  <p data-ev-id="ev_fec84ff808" className="text-xs text-foreground-muted">Configure your AI assistant</p>
                </div>
              </div>
              <p data-ev-id="ev_936583abb0" className="text-sm text-foreground-secondary">
                SAVR uses AI for recipe generation, ingredient scanning, meal planning, and chat assistance.
                Configure your preferred AI provider below.
              </p>
            </div>

            {/* Provider Selection */}
            <Card>
              <h4 data-ev-id="ev_7eb433b344" className="font-medium text-foreground mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-citrus" />
                AI Provider
              </h4>
              <div data-ev-id="ev_a94345353c" className="flex flex-col gap-2">
                {AI_PROVIDERS.map((provider) =>
                <button data-ev-id="ev_867c09933b"
                key={provider.id}
                onClick={() => {
                  setSelectedProvider(provider.id);
                  setSelectedModel(AI_MODELS[provider.id][0]?.id || '');
                }}
                className={`text-left p-3 rounded-lg border transition-all min-h-[44px] ${
                (aiSettings?.preferred_provider || 'openrouter') === provider.id ?
                'border-primary bg-primary/5' :
                'border-border hover:border-foreground-muted'}`
                }>

                    <div data-ev-id="ev_1e723ccf9b" className="flex items-center justify-between">
                      <div data-ev-id="ev_76bdfcac0e">
                        <p data-ev-id="ev_e19f6ba3cd" className="font-medium text-foreground text-sm">{provider.name}</p>
                        <p data-ev-id="ev_d9f34b635f" className="text-xs text-foreground-muted">{provider.description}</p>
                      </div>
                      {(aiSettings?.preferred_provider || 'openrouter') === provider.id &&
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    }
                    </div>
                  </button>
                )}
              </div>
            </Card>

            {/* Model Selection */}
            <Card>
              <h4 data-ev-id="ev_b0a760980b" className="font-medium text-foreground mb-3 flex items-center gap-2">
                <Brain className="w-4 h-4 text-mint" />
                AI Model
              </h4>
              <select data-ev-id="ev_32e4a120fc"
              value={aiSettings?.preferred_model || AI_MODELS[aiSettings?.preferred_provider as AIProvider || 'openrouter'][0]?.id}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full p-3 rounded-lg border border-border bg-background text-foreground min-h-[44px]">

                {AI_MODELS[aiSettings?.preferred_provider as AIProvider || 'openrouter'].map((model) =>
                <option data-ev-id="ev_e4c5c667b0" key={model.id} value={model.id}>{model.name}</option>
                )}
              </select>
              <p data-ev-id="ev_feacd3cdf6" className="text-xs text-foreground-muted mt-2">
                Different models have different capabilities and speeds.
              </p>
            </Card>

            {/* Temperature Setting */}
            <Card>
              <h4 data-ev-id="ev_4771360e06" className="font-medium text-foreground mb-3">Creativity Level</h4>
              <div data-ev-id="ev_8178173c57" className="flex items-center gap-4">
                <span data-ev-id="ev_5b7c17cf38" className="text-xs text-foreground-muted w-16">Precise</span>
                <input data-ev-id="ev_6d2b7a2b53"
                type="range"
                min="0"
                max="1.5"
                step="0.1"
                value={aiSettings?.custom_temperature ?? 0.7}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="flex-1 accent-primary" />

                <span data-ev-id="ev_705f52ec1b" className="text-xs text-foreground-muted w-16 text-right">Creative</span>
              </div>
              <p data-ev-id="ev_8201e9502f" className="text-xs text-foreground-muted mt-2 text-center">
                {(aiSettings?.custom_temperature ?? 0.7) <= 0.3 ? 'More predictable, focused responses' :
                (aiSettings?.custom_temperature ?? 0.7) <= 0.7 ? 'Balanced creativity and accuracy' :
                'More creative and varied responses'}
              </p>
            </Card>

            {/* API Key Notice */}
            <Card className="bg-muted/50 border-dashed">
              <div data-ev-id="ev_851b4c0bdc" className="flex gap-3">
                <Info className="w-5 h-5 text-foreground-muted flex-shrink-0" />
                <div data-ev-id="ev_13df0cd661">
                  <p data-ev-id="ev_bf993d8808" className="text-sm text-foreground font-medium">API Keys</p>
                  <p data-ev-id="ev_3e5fee62a0" className="text-xs text-foreground-secondary mt-1">
                    API keys are securely stored on the server. Contact support to configure custom API keys
                    for Anthropic, OpenAI, or Google providers.
                  </p>
                </div>
              </div>
            </Card>

            {/* Save Button */}
            <Button
              onClick={async () => {
                await updateAISettings({
                  preferred_provider: selectedProvider,
                  preferred_model: selectedModel,
                  custom_temperature: temperature
                });
              }}
              disabled={aiSaving}
              className="w-full">

              {aiSaving ?
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> :

              'Save AI Settings'
              }
            </Button>

            {aiError &&
            <p data-ev-id="ev_a88389315d" className="text-sm text-danger text-center">{aiError}</p>
            }
          </div>);


      case 'about':
        return (
          <div data-ev-id="ev_d7ae821a6a" className="p-4 flex flex-col gap-4 text-center">
            <div data-ev-id="ev_76d1751bbb" className="py-8">
              <div data-ev-id="ev_beca713ca1" className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <ChefHat className="w-10 h-10 text-primary" />
              </div>
              <h2 data-ev-id="ev_056527462e" className="text-2xl font-display font-light text-foreground mb-1">SAVR</h2>
              <p data-ev-id="ev_1d74548684" className="text-sm text-foreground-muted">Version 1.0.0</p>
            </div>
            <p data-ev-id="ev_c4ed8d4343" className="text-sm text-foreground-secondary">
              AI-powered culinary platform for recipe generation, pantry management, and meal
              planning.
            </p>
            <p data-ev-id="ev_c203da9de9" className="text-xs text-foreground-muted">
              © 2024 SAVR. All rights reserved.
            </p>
          </div>);


      default:
        return (
          <div data-ev-id="ev_b987099709" className="p-4 flex flex-col gap-2">
            {[
            { id: 'preferences' as const, label: 'User Preferences', icon: Utensils, description: 'Meal times, cuisines & more' },
            { id: 'storage' as const, label: 'Storage Locations', icon: MapPin },
            { id: 'mode' as const, label: 'Recipe Mode', icon: ChefHat },
            { id: 'dietary' as const, label: 'Dietary Restrictions', icon: Heart },
            { id: 'ai' as const, label: 'AI Configuration', icon: Brain },
            { id: 'notifications' as const, label: 'Notifications', icon: Bell },
            { id: 'appearance' as const, label: 'Appearance', icon: Moon },
            { id: 'security' as const, label: 'Security', icon: Shield },
            { id: 'subscription' as const, label: 'Subscription', icon: CreditCard },
            { id: 'privacy' as const, label: 'Privacy & Consent', icon: FileText },
            { id: 'help' as const, label: 'Help Center', icon: HelpCircle },
            { id: 'about' as const, label: 'About SAVR', icon: Info }].map((item) => {
              const { id, label, icon: Icon, description } = item as {id: SettingsTab;label: string;icon: typeof MapPin;description?: string;};
              return (
                <Card
                  key={id}
                  variant="interactive"
                  padding="sm"
                  className={`cursor-pointer ${id === 'preferences' ? 'border-primary/30 bg-primary/5' : ''}`}
                  onClick={() => setActiveTab(id)}>

                  <div data-ev-id="ev_8cc2cf4dd5" className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${id === 'preferences' ? 'text-primary' : 'text-foreground-muted'}`} />
                    <div data-ev-id="ev_fcc7b07e51" className="flex-1">
                      <span data-ev-id="ev_445ea44566" className="text-foreground block">{label}</span>
                      {description && <span data-ev-id="ev_b0d37260ce" className="text-xs text-foreground-muted">{description}</span>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-foreground-muted" />
                  </div>
                </Card>);

            })}
          </div>);

    }
  };

  const getTabTitle = () => {
    const titles: Record<SettingsTab, string> = {
      main: 'Settings',
      storage: 'Storage Locations',
      mode: 'Recipe Mode',
      dietary: 'Dietary Restrictions',
      preferences: 'User Preferences',
      mealtimes: 'Meal Times',
      cuisine: 'Cuisine & Allergies',
      ai: 'AI Configuration',
      notifications: 'Notifications',
      appearance: 'Appearance',
      security: 'Security',
      subscription: 'Subscription',
      privacy: 'Privacy & Consent',
      help: 'Help Center',
      about: 'About SAVR'
    };
    return titles[activeTab];
  };

  const handleBack = () => {
    // Sub-tabs of preferences go back to preferences
    if (activeTab === 'mealtimes' || activeTab === 'cuisine') {
      setActiveTab('preferences');
    } else {
      setActiveTab('main');
    }
  };

  return (
    <MobileLayout
      title={getTabTitle()}
      headerLeft={
      activeTab !== 'main' ?
      <button data-ev-id="ev_fd0a188646"
      onClick={handleBack}
      className="p-2 text-foreground-muted hover:text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center">

            <ArrowLeft className="w-5 h-5" />
          </button> :
      undefined
      }>

      {renderContent()}
    </MobileLayout>);


}