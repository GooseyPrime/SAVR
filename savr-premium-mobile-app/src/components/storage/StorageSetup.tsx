import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Plus,
  Package,
  Refrigerator,
  Snowflake,
  Wine,
  Check,
  Sparkles } from
'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StorageLocationForm } from './StorageLocationForm';
import { useStorageLocations } from '@/hooks/useStorageLocations';

const ICON_MAP: Record<string, React.ComponentType<{className?: string;strokeWidth?: number;style?: React.CSSProperties;}>> = {
  package: Package,
  refrigerator: Refrigerator,
  snowflake: Snowflake,
  wine: Wine
};

const PRESET_LOCATIONS = [
{ name: 'Refrigerator', icon: 'refrigerator', color: '#5CBAFF', conditions: ['refrigerated'] },
{ name: 'Freezer', icon: 'snowflake', color: '#5CFFE5', conditions: ['frozen'] },
{ name: 'Pantry', icon: 'package', color: '#BAFF5C', conditions: ['room_temp'] },
{ name: 'Wine Cellar', icon: 'wine', color: '#B68AFF', conditions: ['cool_dark'] }];


interface StorageSetupProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function StorageSetup({ onComplete, onSkip }: StorageSetupProps) {
  const { locations, conditions, createLocation } = useStorageLocations();
  const [selectedPresets, setSelectedPresets] = useState<number[]>([0, 1, 2]); // Default: Fridge, Freezer, Pantry
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const togglePreset = (index: number) => {
    setSelectedPresets((prev) =>
    prev.includes(index) ?
    prev.filter((i) => i !== index) :
    [...prev, index]
    );
  };

  const handleCreateLocations = async () => {
    setIsCreating(true);

    // Create selected preset locations
    for (const index of selectedPresets) {
      const preset = PRESET_LOCATIONS[index];
      await createLocation(preset);
    }

    setIsCreating(false);
    onComplete();
  };

  const handleCustomSave = async (data: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    conditions: string[];
  }) => {
    const result = await createLocation(data);
    return result !== null;
  };

  const getIcon = (iconId: string) => {
    return ICON_MAP[iconId] || Package;
  };

  return (
    <div data-ev-id="ev_72cd78bfe4" className="flex flex-col gap-6">
      {/* Intro */}
      <div data-ev-id="ev_d604078140" className="text-center">
        <div data-ev-id="ev_32f2cef757" className="w-16 h-16 border border-primary/40 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-primary" strokeWidth={1.5} />
        </div>
        <h2 data-ev-id="ev_52f4405545" className="font-display text-2xl font-light text-foreground mb-2">
          Setup Storage Locations
        </h2>
        <p data-ev-id="ev_b845ec548e" className="text-foreground-secondary text-base max-w-xs mx-auto">
          Tell us where you store your ingredients. You can always customize these later.
        </p>
      </div>

      {/* Preset Options */}
      <div data-ev-id="ev_3175a4b3d0" className="flex flex-col gap-3">
        {PRESET_LOCATIONS.map((preset, index) => {
          const IconComponent = getIcon(preset.icon);
          const isSelected = selectedPresets.includes(index);

          return (
            <motion.button
              key={preset.name}
              type="button"
              onClick={() => togglePreset(index)}
              whileTap={{ scale: 0.98 }}
              className={`
                flex items-center gap-4 p-4 border text-left transition-all
                ${isSelected ?
              'border-primary bg-primary/5' :
              'border-border hover:border-border-strong'}
              `}>

              <div data-ev-id="ev_64b711a067"
              className="w-12 h-12 border flex items-center justify-center shrink-0"
              style={{ borderColor: preset.color }}>

                <IconComponent
                  className="w-6 h-6"
                  style={{ color: preset.color }}
                  strokeWidth={1.5} />

              </div>
              <div data-ev-id="ev_5eb0b6eb02" className="flex-1">
                <p data-ev-id="ev_77a6676d45" className="font-light text-foreground">{preset.name}</p>
                <p data-ev-id="ev_3090743707" className="text-xs text-foreground-muted font-mono tracking-wider mt-0.5">
                  {conditions.find((c) => c.id === preset.conditions[0])?.label || preset.conditions[0]}
                </p>
              </div>
              <div data-ev-id="ev_46e099199f"
              className={`
                  w-6 h-6 border flex items-center justify-center
                  ${isSelected ? 'border-primary bg-primary' : 'border-border-strong'}
                `}>

                {isSelected && <Check className="w-4 h-4 text-primary-foreground" strokeWidth={2} />}
              </div>
            </motion.button>);

        })}
      </div>

      {/* Custom Location Button */}
      <button data-ev-id="ev_109ac97adb"
      type="button"
      onClick={() => setShowCustomForm(true)}
      className="flex items-center justify-center gap-2 p-4 border border-dashed border-border hover:border-primary text-foreground-muted hover:text-primary transition-all">

        <Plus className="w-4 h-4" strokeWidth={1.5} />
        <span data-ev-id="ev_6ce8cddf20" className="text-sm font-mono tracking-wider">Add Custom Location</span>
      </button>

      {/* Already Created */}
      {locations.length > 0 &&
      <div data-ev-id="ev_52d8cb72cb" className="p-4 bg-primary/5 border border-primary/20">
          <p data-ev-id="ev_977f187fc4" className="text-sm text-foreground font-light">
            <span data-ev-id="ev_b33e6959fe" className="text-primary font-mono">{locations.length}</span> location{locations.length !== 1 ? 's' : ''} already created
          </p>
        </div>
      }

      {/* Actions */}
      <div data-ev-id="ev_a48b9ed122" className="flex flex-col gap-3 mt-2">
        <Button
          fullWidth
          size="lg"
          onClick={handleCreateLocations}
          disabled={isCreating || selectedPresets.length === 0 && locations.length === 0}>

          {isCreating ? 'Creating...' : locations.length > 0 ? 'Continue' : 'Create Locations'}
        </Button>
        <Button variant="ghost" fullWidth onClick={onSkip}>
          Skip for Now
        </Button>
      </div>

      {/* Custom Form */}
      <StorageLocationForm
        isOpen={showCustomForm}
        onClose={() => setShowCustomForm(false)}
        onSave={handleCustomSave}
        conditions={conditions} />

    </div>);

}