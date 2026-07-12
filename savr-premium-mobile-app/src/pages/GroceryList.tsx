/**
 * SAVR Grocery List - Shopping list management
 * Consolidated quantities, store groupings, pantry coverage
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingCart,
  Plus,
  Minus,
  Check,
  Undo,
  Trash2,
  ChevronDown,
  ChevronUp,
  Package,
  AlertCircle,
  RefreshCw,
  Loader2,
  X } from
'lucide-react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAppStore } from '@/store/app-store';

interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  checked: boolean;
  inPantry: boolean;
  source?: 'recipe' | 'mealplan' | 'manual';
}

const storeCategories = [
{ id: 'produce', label: 'Produce', order: 1 },
{ id: 'dairy', label: 'Dairy & Eggs', order: 2 },
{ id: 'meat', label: 'Meat & Seafood', order: 3 },
{ id: 'bakery', label: 'Bakery', order: 4 },
{ id: 'frozen', label: 'Frozen', order: 5 },
{ id: 'pantry', label: 'Pantry', order: 6 },
{ id: 'beverages', label: 'Beverages', order: 7 },
{ id: 'other', label: 'Other', order: 8 }];


// Categorize ingredient by name
function categorizeIngredient(name: string): string {
  const lower = name.toLowerCase();
  
  // Produce
  if (/apple|banana|orange|lemon|lime|grape|berry|lettuce|spinach|kale|tomato|onion|garlic|potato|carrot|celery|pepper|cucumber|zucchini|broccoli|cauliflower|mushroom|avocado|herbs?|cilantro|parsley|basil|mint/i.test(lower)) {
    return 'produce';
  }
  // Dairy
  if (/milk|cheese|butter|cream|yogurt|egg|sour cream|cottage|whipping/i.test(lower)) {
    return 'dairy';
  }
  // Meat
  if (/chicken|beef|pork|lamb|turkey|fish|salmon|tuna|shrimp|bacon|sausage|ham|steak|ground/i.test(lower)) {
    return 'meat';
  }
  // Bakery
  if (/bread|roll|bun|bagel|tortilla|pita|croissant|muffin|cake/i.test(lower)) {
    return 'bakery';
  }
  // Frozen
  if (/frozen|ice cream/i.test(lower)) {
    return 'frozen';
  }
  // Beverages
  if (/juice|soda|water|coffee|tea|wine|beer/i.test(lower)) {
    return 'beverages';
  }
  // Pantry (default for most ingredients)
  return 'pantry';
}

export default function GroceryList() {
  const { inventory } = useAppStore();
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Load ingredients from sessionStorage (passed from Plans page)
  useEffect(() => {
    if (initialized) return;
    
    const storedIngredients = sessionStorage.getItem('groceryListIngredients');
    if (storedIngredients) {
      try {
        const ingredients = JSON.parse(storedIngredients) as { name: string; amount: string; unit: string }[];
        
        // Convert to GroceryItems and consolidate duplicates
        const consolidated = new Map<string, GroceryItem>();
        
        ingredients.forEach((ing) => {
          const key = ing.name.toLowerCase();
          const existing = consolidated.get(key);
          
          // Check if in pantry
          const inPantry = inventory.some(
            (item) => item.name.toLowerCase() === key
          );
          
          if (existing) {
            // Consolidate quantities if possible
            const newQty = parseFloat(ing.amount) || 1;
            existing.quantity += newQty;
          } else {
            consolidated.set(key, {
              id: crypto.randomUUID(),
              name: ing.name,
              quantity: parseFloat(ing.amount) || 1,
              unit: ing.unit || '',
              category: categorizeIngredient(ing.name),
              checked: false,
              inPantry,
              source: 'mealplan',
            });
          }
        });
        
        setItems(Array.from(consolidated.values()));
        
        // Clear sessionStorage after loading
        sessionStorage.removeItem('groceryListIngredients');
      } catch (e) {
        console.error('Failed to parse grocery ingredients:', e);
      }
    }
    
    setInitialized(true);
  }, [initialized, inventory]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  // Group items by category
  const groupedItems = useMemo(() => {
    const unchecked = items.filter((i) => !i.checked);
    const groups: Record<string, GroceryItem[]> = {};

    unchecked.forEach((item) => {
      const cat = item.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });

    return storeCategories.
    filter((cat) => groups[cat.id]?.length > 0).
    map((cat) => ({
      ...cat,
      items: groups[cat.id] || []
    }));
  }, [items]);

  const checkedItems = useMemo(() => items.filter((i) => i.checked), [items]);
  const totalItems = items.length;
  const checkedCount = checkedItems.length;
  const progress = totalItems > 0 ? checkedCount / totalItems * 100 : 0;

  const checkItem = useCallback((id: string) => {
    setItems((prev) =>
    prev.map((item) => item.id === id ? { ...item, checked: true } : item)
    );
    setLastChecked(id);
  }, []);

  const uncheckItem = useCallback((id: string) => {
    setItems((prev) =>
    prev.map((item) => item.id === id ? { ...item, checked: false } : item)
    );
  }, []);

  const undoLastCheck = useCallback(() => {
    if (lastChecked) {
      uncheckItem(lastChecked);
      setLastChecked(null);
    }
  }, [lastChecked, uncheckItem]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, delta: number) => {
    setItems((prev) =>
    prev.map((item) =>
    item.id === id ?
    { ...item, quantity: Math.max(0, item.quantity + delta) } :
    item
    )
    );
  }, []);

  const addItem = useCallback(() => {
    if (!newItemName.trim()) return;

    // Check if item is already in pantry
    const inPantry = inventory.some(
      (inv) => inv.name.toLowerCase() === newItemName.toLowerCase().trim()
    );

    setItems((prev) => [
    ...prev,
    {
      id: crypto.randomUUID(),
      name: newItemName.trim(),
      quantity: 1,
      unit: 'item',
      category: 'other',
      checked: false,
      inPantry,
      source: 'manual'
    }]
    );
    setNewItemName('');
    setShowAddForm(false);
  }, [newItemName, inventory]);

  const clearChecked = useCallback(() => {
    setItems((prev) => prev.filter((item) => !item.checked));
  }, []);

  // Empty state
  if (items.length === 0 && !isLoading) {
    return (
      <MobileLayout
        title="Grocery List"
        headerRight={
        <Button size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4" />
            Add
          </Button>
        }>

        <div data-ev-id="ev_c86ea20d54" className="flex flex-col items-center justify-center h-[60vh] px-6 text-center">
          <div data-ev-id="ev_4fb7a1fd13" className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
            <ShoppingCart className="w-10 h-10 text-foreground-muted" />
          </div>
          <h2 data-ev-id="ev_b3e0a94160" className="text-xl font-display font-light text-foreground mb-2">
            No items yet
          </h2>
          <p data-ev-id="ev_f91a2bd3fa" className="text-foreground-secondary mb-6">
            Add items manually or generate a list from your meal plan
          </p>
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4" />
            Add First Item
          </Button>
        </div>

        {/* Add item modal */}
        <AnimatePresence>
          {showAddForm &&
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/95 flex items-end">

              <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full bg-surface border-t border-border p-4 pb-safe">

                <div data-ev-id="ev_d80c1ef772" className="flex items-center gap-2">
                  <Input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Item name..."
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && addItem()}
                  autoFocus />

                  <Button onClick={addItem} disabled={!newItemName.trim()}>
                    Add
                  </Button>
                  <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          }
        </AnimatePresence>
      </MobileLayout>);

  }

  // Loading state
  if (isLoading) {
    return (
      <MobileLayout title="Grocery List">
        <div data-ev-id="ev_b5b081a26e" className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
          <p data-ev-id="ev_663042ebf4" className="text-foreground-secondary">Loading grocery list...</p>
        </div>
      </MobileLayout>);

  }

  return (
    <MobileLayout
      title="Grocery List"
      headerRight={
      <Button size="sm" onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4" />
          Add
        </Button>
      }>

      <div data-ev-id="ev_8a265b8787" className="flex flex-col">
        {/* Progress bar */}
        <div data-ev-id="ev_691e17db1e" className="px-4 py-3 border-b border-border bg-surface">
          <div data-ev-id="ev_4fd47874b7" className="flex items-center justify-between mb-2">
            <span data-ev-id="ev_6c1428d21d" className="text-sm text-foreground-secondary">
              {checkedCount} of {totalItems} items
            </span>
            {lastChecked &&
            <button data-ev-id="ev_e3ac778a52"
            onClick={undoLastCheck}
            className="flex items-center gap-1 text-sm text-primary hover:text-primary-hover">

                <Undo className="w-3 h-3" />
                Undo
              </button>
            }
          </div>
          <div data-ev-id="ev_0361c31dbd" className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }} />

          </div>
        </div>

        {/* Error message */}
        {error &&
        <div data-ev-id="ev_7e118383a8" className="mx-4 mt-4 p-3 bg-error/10 border border-error/20 rounded-[var(--radius-md)] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-error flex-shrink-0" />
            <p data-ev-id="ev_6438e61ff0" className="text-sm text-error">{error}</p>
          </div>
        }

        {/* Grouped items */}
        <div data-ev-id="ev_34fbf87e6c" className="px-4 py-4 flex flex-col gap-4">
          {groupedItems.map((group) =>
          <div data-ev-id="ev_27dfb53526" key={group.id}>
              <h3 data-ev-id="ev_38012737ff" className="text-xs font-mono text-foreground-muted tracking-wider uppercase mb-2">
                {group.label}
              </h3>
              <div data-ev-id="ev_b7ef85f77c" className="flex flex-col gap-2">
                {group.items.map((item) =>
              <Card key={item.id} padding="sm" className="flex items-center gap-3">
                    <button data-ev-id="ev_fb3e763c03"
                onClick={() => checkItem(item.id)}
                className="w-6 h-6 border border-border rounded-full flex items-center justify-center hover:border-primary hover:bg-primary/10 transition-colors"
                aria-label={`Check off ${item.name}`}>

                      <Check className="w-4 h-4 text-transparent" />
                    </button>
                    <div data-ev-id="ev_dc6daaa0ec" className="flex-1 min-w-0">
                      <p data-ev-id="ev_1842fc7861" className="text-foreground truncate">{item.name}</p>
                      {item.inPantry &&
                  <span data-ev-id="ev_f13d74959e" className="text-xs text-success flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          In pantry
                        </span>
                  }
                    </div>
                    <div data-ev-id="ev_5d0897b614" className="flex items-center gap-1">
                      <button data-ev-id="ev_03dcdf98af"
                  onClick={() => updateQuantity(item.id, -1)}
                  className="w-7 h-7 border border-border flex items-center justify-center rounded-[var(--radius-sm)] hover:border-foreground-secondary"
                  aria-label="Decrease quantity">

                        <Minus className="w-3 h-3" />
                      </button>
                      <span data-ev-id="ev_9fd47fee6e" className="w-8 text-center text-sm font-mono">{item.quantity}</span>
                      <button data-ev-id="ev_84eca8ff6f"
                  onClick={() => updateQuantity(item.id, 1)}
                  className="w-7 h-7 border border-border flex items-center justify-center rounded-[var(--radius-sm)] hover:border-foreground-secondary"
                  aria-label="Increase quantity">

                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button data-ev-id="ev_551c506d57"
                onClick={() => removeItem(item.id)}
                className="p-2 text-foreground-muted hover:text-error transition-colors"
                aria-label="Remove item">

                      <Trash2 className="w-4 h-4" />
                    </button>
                  </Card>
              )}
              </div>
            </div>
          )}
        </div>

        {/* Completed items */}
        {checkedItems.length > 0 &&
        <div data-ev-id="ev_d03b32a4d1" className="px-4 pb-4">
            <button data-ev-id="ev_ddf94117fe"
          onClick={() => setShowCompleted(!showCompleted)}
          className="flex items-center justify-between w-full py-2 text-foreground-secondary">

              <span data-ev-id="ev_d5f74edf62" className="text-sm">
                {checkedCount} completed item{checkedCount !== 1 ? 's' : ''}
              </span>
              {showCompleted ?
            <ChevronUp className="w-4 h-4" /> :

            <ChevronDown className="w-4 h-4" />
            }
            </button>

            <AnimatePresence>
              {showCompleted &&
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden">

                  <div data-ev-id="ev_109e502953" className="flex flex-col gap-2 pt-2">
                    {checkedItems.map((item) =>
                <Card key={item.id} padding="sm" className="flex items-center gap-3 opacity-60">
                        <button data-ev-id="ev_1ebd0f7c7b"
                  onClick={() => uncheckItem(item.id)}
                  className="w-6 h-6 bg-primary border border-primary rounded-full flex items-center justify-center"
                  aria-label={`Uncheck ${item.name}`}>

                          <Check className="w-4 h-4 text-primary-foreground" />
                        </button>
                        <span data-ev-id="ev_96c47dd075" className="flex-1 line-through text-foreground-muted">{item.name}</span>
                      </Card>
                )}
                  </div>
                  <Button
                variant="ghost"
                size="sm"
                onClick={clearChecked}
                className="mt-3 text-foreground-muted">

                    <Trash2 className="w-3 h-3" />
                    Clear completed
                  </Button>
                </motion.div>
            }
            </AnimatePresence>
          </div>
        }
      </div>

      {/* Add item modal */}
      <AnimatePresence>
        {showAddForm &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/95 flex items-end">

            <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="w-full bg-surface border-t border-border p-4 pb-safe">

              <div data-ev-id="ev_1e0d34a582" className="flex items-center gap-2">
                <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Item name..."
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
                autoFocus />

                <Button onClick={addItem} disabled={!newItemName.trim()}>
                  Add
                </Button>
                <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </MobileLayout>);

}