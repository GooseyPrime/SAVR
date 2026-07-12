/**
 * SAVR Pantry Page
 * Inventory management with search, filters, and location grouping
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Camera,
  Search,
  Trash2,
  Package,
  Refrigerator,
  Snowflake,
  Apple,
  Beef,
  Milk,
  Wheat,
  Leaf,
  X,
  AlertTriangle,
  Filter } from
'lucide-react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Scanner } from '@/components/scanner/Scanner';
import { useAppStore, type InventoryItem } from '@/store/app-store';

const categories = [
{ id: 'all', label: 'All', icon: Package },
{ id: 'produce', label: 'Produce', icon: Apple },
{ id: 'protein', label: 'Protein', icon: Beef },
{ id: 'dairy', label: 'Dairy', icon: Milk },
{ id: 'grains', label: 'Grains', icon: Wheat },
{ id: 'other', label: 'Other', icon: Leaf }];


const locationIcons = {
  refrigerator: Refrigerator,
  freezer: Snowflake,
  pantry: Package
};

const locationLabels = {
  refrigerator: 'Refrigerator',
  freezer: 'Freezer',
  pantry: 'Pantry'
};

export default function Pantry() {
  const { inventory, removeInventoryItem } = useAppStore();
  const [showScanner, setShowScanner] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filter items
  const filteredItems = useMemo(() => {
    return inventory.filter((item) => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [inventory, activeCategory, searchQuery]);

  // Group by location
  const groupedItems = useMemo(() => {
    return filteredItems.reduce((acc, item) => {
      const loc = item.location || 'pantry';
      if (!acc[loc]) acc[loc] = [];
      acc[loc].push(item);
      return acc;
    }, {} as Record<string, typeof filteredItems>);
  }, [filteredItems]);

  // Expiring soon (within 3 days)
  const expiringCount = useMemo(() => {
    const now = new Date();
    const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    return inventory.filter((item) => {
      if (!item.expirationDate) return false;
      const expDate = new Date(item.expirationDate);
      return expDate <= threeDays && expDate >= now;
    }).length;
  }, [inventory]);

  const handleDelete = (item: InventoryItem) => {
    setItemToDelete(item);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      removeInventoryItem(itemToDelete.id);
      setItemToDelete(null);
    }
  };

  // Check if item is expiring soon
  const isExpiringSoon = (item: InventoryItem) => {
    if (!item.expirationDate) return false;
    const now = new Date();
    const expDate = new Date(item.expirationDate);
    const daysUntil = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil <= 3 && daysUntil >= 0;
  };

  const isExpired = (item: InventoryItem) => {
    if (!item.expirationDate) return false;
    return new Date(item.expirationDate) < new Date();
  };

  return (
    <MobileLayout
      title="Pantry"
      headerRight={
      <Button size="sm" onClick={() => setShowScanner(true)}>
          <Camera className="w-4 h-4" />
          Scan
        </Button>
      }>

      <div data-ev-id="ev_3b0fa7c203" className="flex flex-col gap-4 px-4 py-4">
        {/* Search and Filter */}
        <div data-ev-id="ev_80a5c957ef" className="flex gap-2">
          <div data-ev-id="ev_8cea18b306" className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <Input
              placeholder="Search inventory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10" />

            {searchQuery &&
            <button data-ev-id="ev_e0afeb3e32"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1">

                <X className="w-4 h-4 text-foreground-muted" />
              </button>
            }
          </div>
          <Button
            variant={showFilters ? 'primary' : 'outline'}
            onClick={() => setShowFilters(!showFilters)}
            className="px-3">

            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {/* Category filter chips */}
        <AnimatePresence>
          {showFilters &&
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2 overflow-hidden">

              {categories.map(({ id, label, icon: Icon }) =>
            <button data-ev-id="ev_046768aa39"
            key={id}
            onClick={() => setActiveCategory(id)}
            className={`
                    flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors
                    ${activeCategory === id ?
            'bg-primary text-primary-foreground' :
            'bg-surface-raised text-foreground-secondary border border-border'}
                  `
            }>

                  <Icon className="w-4 h-4" strokeWidth={1.5} />
                  {label}
                </button>
            )}
            </motion.div>
          }
        </AnimatePresence>

        {/* Quick Stats */}
        <div data-ev-id="ev_257acc92a9" className="grid grid-cols-3 gap-3">
          <div data-ev-id="ev_d27c9fdfb1" className="bg-surface rounded-lg p-3 text-center border border-border">
            <p data-ev-id="ev_1a07d669d0" className="text-2xl font-semibold text-foreground">{inventory.length}</p>
            <p data-ev-id="ev_36c26b1f2b" className="text-xs text-foreground-muted">Items</p>
          </div>
          <div data-ev-id="ev_9893b4e10f" className="bg-surface rounded-lg p-3 text-center border border-border">
            <p data-ev-id="ev_2ca04c0b4d" className="text-2xl font-semibold text-foreground">
              {new Set(inventory.map((i) => i.category)).size}
            </p>
            <p data-ev-id="ev_d6d52d11db" className="text-xs text-foreground-muted">Categories</p>
          </div>
          <div data-ev-id="ev_063a6c4475" className="bg-surface rounded-lg p-3 text-center border border-border">
            <p data-ev-id="ev_866f34cc91" className={`text-2xl font-semibold ${expiringCount > 0 ? 'text-warning' : 'text-foreground'}`}>
              {expiringCount}
            </p>
            <p data-ev-id="ev_7e896f9e7b" className="text-xs text-foreground-muted">Expiring</p>
          </div>
        </div>

        {/* Results info */}
        {(searchQuery || activeCategory !== 'all') &&
        <p data-ev-id="ev_1122dbebbc" className="text-sm text-foreground-muted">
            {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} found
          </p>
        }

        {/* Inventory list */}
        {filteredItems.length === 0 ?
        <Card variant="ghost" className="py-16 text-center">
            <Package className="w-12 h-12 text-foreground-muted mx-auto mb-4" strokeWidth={1} />
            <h3 data-ev-id="ev_ac8f9e6c75" className="font-medium text-foreground mb-2">
              {inventory.length === 0 ? 'Your pantry is empty' : 'No items match your search'}
            </h3>
            <p data-ev-id="ev_0649aff1c6" className="text-foreground-secondary text-sm mb-4">
              {inventory.length === 0 ?
            'Scan your ingredients to get started' :
            'Try adjusting your search or filters'
            }
            </p>
            {inventory.length === 0 &&
          <Button onClick={() => setShowScanner(true)}>
                <Camera className="w-4 h-4" />
                Scan Items
              </Button>
          }
          </Card> :

        Object.entries(groupedItems).map(([loc, items]) => {
          const LocationIcon = locationIcons[loc as keyof typeof locationIcons] || Package;
          const locationLabel = locationLabels[loc as keyof typeof locationLabels] || loc;

          return (
            <motion.section
              key={loc}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}>

                <div data-ev-id="ev_d86f9056e7" className="flex items-center gap-2 mb-3">
                  <LocationIcon className="w-4 h-4 text-primary" strokeWidth={1.5} />
                  <h3 data-ev-id="ev_c46789ab19" className="text-sm font-medium text-foreground">
                    {locationLabel}
                  </h3>
                  <span data-ev-id="ev_cd80d05d83" className="text-xs text-foreground-muted">({items.length})</span>
                </div>

                <div data-ev-id="ev_3abbd690bd" className="flex flex-col gap-2">
                  {items.map((item) => {
                  const expiring = isExpiringSoon(item);
                  const expired = isExpired(item);

                  return (
                    <Card
                      key={item.id}
                      variant="bordered"
                      padding="sm"
                      className={expired ? 'border-error/30 bg-error/5' : expiring ? 'border-warning/30 bg-warning/5' : ''}>

                        <div data-ev-id="ev_e49313a80b" className="flex items-center gap-3">
                          <div data-ev-id="ev_2ad866d226" className="flex-1 min-w-0">
                            <div data-ev-id="ev_7d77951897" className="flex items-center gap-2">
                              <p data-ev-id="ev_a8e44d63a1" className="font-medium text-foreground truncate">{item.name}</p>
                              {(expired || expiring) &&
                            <AlertTriangle
                              className={`w-4 h-4 shrink-0 ${expired ? 'text-error' : 'text-warning'}`}
                              strokeWidth={2} />

                            }
                            </div>
                            <div data-ev-id="ev_ef8643a49a" className="flex items-center gap-2 mt-1">
                              <span data-ev-id="ev_a8199c0143" className="text-xs text-foreground-muted capitalize">
                                {item.category}
                              </span>
                              {item.quantity &&
                            <>
                                  <span data-ev-id="ev_ca44f23603" className="text-foreground-muted">•</span>
                                  <span data-ev-id="ev_26c555303e" className="text-xs text-foreground-secondary">
                                    {item.quantity} {item.unit || 'pcs'}
                                  </span>
                                </>
                            }
                              {item.expirationDate &&
                            <>
                                  <span data-ev-id="ev_c527c93c80" className="text-foreground-muted">•</span>
                                  <span data-ev-id="ev_56be996cd7" className={`text-xs ${expired ? 'text-error' : expiring ? 'text-warning' : 'text-foreground-muted'}`}>
                                    {expired ? 'Expired' : `Exp ${new Date(item.expirationDate).toLocaleDateString()}`}
                                  </span>
                                </>
                            }
                            </div>
                          </div>
                          <button data-ev-id="ev_472c5887cf"
                        onClick={() => handleDelete(item)}
                        className="p-2 text-foreground-muted hover:text-error transition-colors"
                        aria-label={`Delete ${item.name}`}>

                            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                        </div>
                      </Card>);

                })}
                </div>
              </motion.section>);

        })
        }
      </div>

      {/* Scanner */}
      <Scanner isOpen={showScanner} onClose={() => setShowScanner(false)} />

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {itemToDelete &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4">

            <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-sm">

              <Card variant="bordered" padding="lg">
                <div data-ev-id="ev_7aedb1a7c1" className="text-center mb-6">
                  <div data-ev-id="ev_c0fdfe15f0" className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="w-6 h-6 text-error" strokeWidth={1.5} />
                  </div>
                  <h3 data-ev-id="ev_246972ea11" className="text-lg font-medium text-foreground mb-2">Remove Item</h3>
                  <p data-ev-id="ev_a51e187b5e" className="text-foreground-secondary text-sm">
                    Remove <span data-ev-id="ev_99176f0d7e" className="text-foreground font-medium">{itemToDelete.name}</span> from your pantry?
                  </p>
                </div>
                <div data-ev-id="ev_47ff2e5aa0" className="flex gap-3">
                  <Button variant="outline" fullWidth onClick={() => setItemToDelete(null)}>
                    Cancel
                  </Button>
                  <Button variant="danger" fullWidth onClick={confirmDelete}>
                    Remove
                  </Button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </MobileLayout>);

}