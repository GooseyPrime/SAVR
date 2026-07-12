import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Package,
  Refrigerator,
  Snowflake,
  Wine,
  Warehouse,
  Archive,
  Box,
  Home,
  Loader2,
  Check } from
'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import type { StorageLocation, StorageCondition } from '@/hooks/useStorageLocations';

const ICONS = [
{ id: 'package', icon: Package, label: 'Package' },
{ id: 'refrigerator', icon: Refrigerator, label: 'Fridge' },
{ id: 'snowflake', icon: Snowflake, label: 'Freezer' },
{ id: 'wine', icon: Wine, label: 'Wine' },
{ id: 'warehouse', icon: Warehouse, label: 'Storage' },
{ id: 'archive', icon: Archive, label: 'Archive' },
{ id: 'box', icon: Box, label: 'Box' },
{ id: 'home', icon: Home, label: 'Home' }];


const COLORS = [
'#BAFF5C', // Primary lime
'#5CFFBA', // Mint
'#FFE55C', // Citrus
'#5CBAFF', // Sky
'#FF6B6B', // Coral
'#B68AFF', // Lavender
'#FF8A5C', // Peach
'#5CFFE5' // Aqua
];

interface StorageLocationFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    conditions: string[];
  }) => Promise<boolean>;
  editingLocation?: StorageLocation | null;
  conditions: StorageCondition[];
}

export function StorageLocationForm({
  isOpen,
  onClose,
  onSave,
  editingLocation,
  conditions
}: StorageLocationFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('package');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingLocation) {
      setName(editingLocation.name);
      setDescription(editingLocation.description || '');
      setSelectedIcon(editingLocation.icon || 'package');
      setSelectedColor(editingLocation.color || COLORS[0]);
      setSelectedConditions(editingLocation.conditions || []);
    } else {
      setName('');
      setDescription('');
      setSelectedIcon('package');
      setSelectedColor(COLORS[0]);
      setSelectedConditions([]);
    }
    setError('');
  }, [editingLocation, isOpen]);

  const toggleCondition = (conditionId: string) => {
    setSelectedConditions((prev) =>
    prev.includes(conditionId) ?
    prev.filter((c) => c !== conditionId) :
    [...prev, conditionId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setIsSaving(true);
    setError('');

    const success = await onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      icon: selectedIcon,
      color: selectedColor,
      conditions: selectedConditions
    });

    setIsSaving(false);

    if (success) {
      onClose();
    } else {
      setError('Failed to save. Please try again.');
    }
  };

  const getIconComponent = (iconId: string) => {
    const found = ICONS.find((i) => i.id === iconId);
    return found?.icon || Package;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">

        <div data-ev-id="ev_5a37cee208" className="min-h-screen flex flex-col">
          {/* Header */}
          <div data-ev-id="ev_e5e5e2f7ca" className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
            <div data-ev-id="ev_5d0a5592b0" className="flex items-center justify-between p-4">
              <button data-ev-id="ev_009ef53042"
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-foreground-muted hover:text-foreground transition-colors">

                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
              <h2 data-ev-id="ev_e36c6761df" className="font-display text-lg font-light text-foreground">
                {editingLocation ? 'Edit Location' : 'New Location'}
              </h2>
              <div data-ev-id="ev_4689c194a2" className="w-10" />
            </div>
          </div>

          {/* Form */}
          <form data-ev-id="ev_877ba5b954" onSubmit={handleSubmit} className="flex-1 flex flex-col p-5 gap-6">
            {/* Preview */}
            <div data-ev-id="ev_abcce29f1c" className="flex justify-center py-4">
              <div data-ev-id="ev_e569220185"
              className="w-20 h-20 border-2 flex items-center justify-center transition-all"
              style={{ borderColor: selectedColor }}>

                {(() => {
                  const IconComp = getIconComponent(selectedIcon);
                  return <IconComp className="w-10 h-10" style={{ color: selectedColor }} strokeWidth={1.5} />;
                })()}
              </div>
            </div>

            {/* Name */}
            <Input
              label="Location Name"
              placeholder="e.g., Wine Cellar, Salumi Fridge"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={error && !name.trim() ? error : undefined}
              autoFocus />


            {/* Description */}
            <Input
              label="Description (optional)"
              placeholder="e.g., For cured meats and aged cheeses"
              value={description}
              onChange={(e) => setDescription(e.target.value)} />


            {/* Icon Selection */}
            <div data-ev-id="ev_cebc0d3acc">
              <label data-ev-id="ev_7b79bea808" className="block text-xs font-mono tracking-[0.15em] uppercase text-foreground-muted mb-3">
                Icon
              </label>
              <div data-ev-id="ev_ebf5e6b7ce" className="grid grid-cols-4 gap-2">
                {ICONS.map(({ id, icon: Icon, label }) =>
                <button data-ev-id="ev_c79dc48785"
                key={id}
                type="button"
                onClick={() => setSelectedIcon(id)}
                className={`
                      flex flex-col items-center gap-2 p-3 border transition-all
                      ${selectedIcon === id ?
                'border-primary bg-primary/10' :
                'border-border hover:border-border-strong'}
                    `}>

                    <Icon
                    className={`w-5 h-5 ${selectedIcon === id ? 'text-primary' : 'text-foreground-muted'}`}
                    strokeWidth={1.5} />

                    <span data-ev-id="ev_d8a005a60c" className="text-[10px] text-foreground-muted font-mono tracking-wider">
                      {label}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Color Selection */}
            <div data-ev-id="ev_b43b325ee5">
              <label data-ev-id="ev_97821aaa4a" className="block text-xs font-mono tracking-[0.15em] uppercase text-foreground-muted mb-3">
                Color
              </label>
              <div data-ev-id="ev_465e029762" className="flex gap-2 flex-wrap">
                {COLORS.map((color) =>
                <button data-ev-id="ev_197aa79c54"
                key={color}
                type="button"
                onClick={() => setSelectedColor(color)}
                className={`
                      w-10 h-10 border-2 transition-all flex items-center justify-center
                      ${selectedColor === color ? 'border-foreground' : 'border-transparent'}
                    `}
                style={{ backgroundColor: color }}>

                    {selectedColor === color &&
                  <Check className="w-5 h-5 text-background" strokeWidth={2} />
                  }
                  </button>
                )}
              </div>
            </div>

            {/* Storage Conditions */}
            <div data-ev-id="ev_5cc80acec0">
              <label data-ev-id="ev_8c43e3cf2e" className="block text-xs font-mono tracking-[0.15em] uppercase text-foreground-muted mb-3">
                Storage Conditions
              </label>
              <div data-ev-id="ev_9552cc07cb" className="flex flex-col gap-2">
                {conditions.map((condition) =>
                <button data-ev-id="ev_f3fa085d28"
                key={condition.id}
                type="button"
                onClick={() => toggleCondition(condition.id)}
                className={`
                      flex items-center gap-4 p-4 border text-left transition-all
                      ${selectedConditions.includes(condition.id) ?
                'border-primary bg-primary/5' :
                'border-border hover:border-border-strong'}
                    `}>

                    <div data-ev-id="ev_b7b79acec3"
                  className={`
                        w-5 h-5 border flex items-center justify-center shrink-0
                        ${selectedConditions.includes(condition.id) ?
                  'border-primary bg-primary' :
                  'border-border-strong'}
                      `}>

                      {selectedConditions.includes(condition.id) &&
                    <Check className="w-3 h-3 text-primary-foreground" strokeWidth={2} />
                    }
                    </div>
                    <div data-ev-id="ev_30f18bc638" className="flex-1 min-w-0">
                      <p data-ev-id="ev_b18ee1f396" className="font-light text-foreground">{condition.label}</p>
                      {condition.temp_range &&
                    <p data-ev-id="ev_228be26ed7" className="text-xs text-foreground-muted font-mono mt-0.5">
                          {condition.temp_range}
                        </p>
                    }
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Error */}
            {error && name.trim() &&
            <div data-ev-id="ev_d890aaac3c" className="p-4 bg-error/5 border border-error/20 text-error text-sm font-light">
                {error}
              </div>
            }

            {/* Submit */}
            <div data-ev-id="ev_82070bdd49" className="mt-auto pt-4">
              <Button type="submit" fullWidth size="lg" disabled={isSaving}>
                {isSaving ?
                <Loader2 className="w-4 h-4 animate-spin" /> :
                editingLocation ?
                'Save Changes' :

                'Create Location'
                }
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </AnimatePresence>);

}