import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Package,
  Refrigerator,
  Snowflake,
  Wine,
  Warehouse,
  Archive,
  Box,
  Home,
  Trash2,
  Pencil,
  GripVertical,
  Loader2 } from
'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StorageLocationForm } from './StorageLocationForm';
import { useStorageLocations, type StorageLocation } from '@/hooks/useStorageLocations';

const ICON_MAP: Record<string, React.ComponentType<{className?: string;strokeWidth?: number;style?: React.CSSProperties;}>> = {
  package: Package,
  refrigerator: Refrigerator,
  snowflake: Snowflake,
  wine: Wine,
  warehouse: Warehouse,
  archive: Archive,
  box: Box,
  home: Home
};

interface StorageLocationsManagerProps {
  compact?: boolean;
}

export function StorageLocationsManager({ compact = false }: StorageLocationsManagerProps) {
  const {
    locations,
    conditions,
    isLoading,
    error,
    createLocation,
    updateLocation,
    deleteLocation
  } = useStorageLocations();

  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<StorageLocation | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StorageLocation | null>(null);

  const handleSave = async (data: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    conditions: string[];
  }) => {
    if (editingLocation) {
      return await updateLocation(editingLocation.id, data);
    } else {
      const result = await createLocation(data);
      return result !== null;
    }
  };

  const handleEdit = (location: StorageLocation) => {
    setEditingLocation(location);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    await deleteLocation(confirmDelete.id);
    setDeletingId(null);
    setConfirmDelete(null);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingLocation(null);
  };

  const getIcon = (iconId: string | null) => {
    return ICON_MAP[iconId || 'package'] || Package;
  };

  if (isLoading) {
    return (
      <div data-ev-id="ev_1b38e54751" className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>);

  }

  return (
    <div data-ev-id="ev_1a88aa7da4" className={compact ? '' : 'flex flex-col gap-5'}>
      {/* Header */}
      {!compact &&
      <div data-ev-id="ev_54837215ad" className="flex items-center justify-between">
          <div data-ev-id="ev_fa477abf37">
            <h3 data-ev-id="ev_ab4bf45d3d" className="font-display text-lg font-light text-foreground">Storage Locations</h3>
            <p data-ev-id="ev_d2b274d70e" className="text-sm text-foreground-muted mt-1">
              Customize where you store your ingredients
            </p>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
      }

      {/* Error */}
      {error &&
      <div data-ev-id="ev_24932f7f5b" className="p-4 bg-error/5 border border-error/20 text-error text-sm font-light">
          {error}
        </div>
      }

      {/* Locations List */}
      {locations.length === 0 ?
      <Card variant="ghost" className="py-12 text-center">
          <Package className="w-12 h-12 text-foreground-muted mx-auto mb-4" strokeWidth={1} />
          <p data-ev-id="ev_6e5c8c3d88" className="text-foreground-secondary font-light mb-4">
            No storage locations yet
          </p>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />
            Create Your First Location
          </Button>
        </Card> :

      <div data-ev-id="ev_6578adfde9" className="flex flex-col gap-2">
          {locations.map((location) => {
          const IconComponent = getIcon(location.icon);
          return (
            <motion.div
              key={location.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}>

                <Card variant="interactive" padding="sm" glowOnHover>
                  <div data-ev-id="ev_b44695902f" className="flex items-center gap-4">
                    <div data-ev-id="ev_715ad66821" className="text-foreground-muted cursor-grab active:cursor-grabbing">
                      <GripVertical className="w-4 h-4" strokeWidth={1.5} />
                    </div>
                    <div data-ev-id="ev_f2ce1d953e"
                  className="w-12 h-12 border flex items-center justify-center shrink-0"
                  style={{ borderColor: location.color || '#BAFF5C' }}>

                      <IconComponent
                      className="w-6 h-6"
                      style={{ color: location.color || '#BAFF5C' }}
                      strokeWidth={1.5} />

                    </div>
                    <div data-ev-id="ev_54fa03d9d5" className="flex-1 min-w-0">
                      <p data-ev-id="ev_53469827b7" className="font-light text-foreground truncate">{location.name}</p>
                      {location.conditions && location.conditions.length > 0 &&
                    <p data-ev-id="ev_fcb50059a5" className="text-xs text-foreground-muted font-mono tracking-wider mt-0.5 truncate">
                          {location.conditions.
                      map((c) => conditions.find((cond) => cond.id === c)?.label || c).
                      join(' · ')}
                        </p>
                    }
                    </div>
                    <div data-ev-id="ev_624f5c2578" className="flex items-center gap-1">
                      <button data-ev-id="ev_4eea909072"
                    onClick={() => handleEdit(location)}
                    className="p-2.5 text-foreground-muted hover:text-foreground transition-colors">

                        <Pencil className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                      <button data-ev-id="ev_cd10c8f2d7"
                    onClick={() => setConfirmDelete(location)}
                    disabled={deletingId === location.id}
                    className="p-2.5 text-foreground-muted hover:text-error transition-colors disabled:opacity-50">

                        {deletingId === location.id ?
                      <Loader2 className="w-4 h-4 animate-spin" /> :

                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                      }
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>);

        })}
        </div>
      }

      {/* Compact Add Button */}
      {compact && locations.length > 0 &&
      <Button variant="outline" fullWidth onClick={() => setShowForm(true)} className="mt-3">
          <Plus className="w-4 h-4" />
          Add Location
        </Button>
      }

      {/* Form Modal */}
      <StorageLocationForm
        isOpen={showForm}
        onClose={handleCloseForm}
        onSave={handleSave}
        editingLocation={editingLocation}
        conditions={conditions} />


      {/* Delete Confirmation */}
      <AnimatePresence>
        {confirmDelete &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-5">

            <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}>

              <Card variant="bordered" padding="lg" className="max-w-sm w-full">
                <div data-ev-id="ev_97b7b657e3" className="text-center mb-6">
                  <div data-ev-id="ev_746c48d5fe" className="w-14 h-14 border border-error/30 flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="w-7 h-7 text-error" strokeWidth={1.5} />
                  </div>
                  <h3 data-ev-id="ev_6f460a45dc" className="font-display text-xl font-light text-foreground mb-2">
                    Delete Location
                  </h3>
                  <p data-ev-id="ev_709e21f7ac" className="text-foreground-secondary text-sm font-light">
                    Delete <span data-ev-id="ev_235f562f62" className="text-foreground">{confirmDelete.name}</span>?
                    Items in this location will be unassigned.
                  </p>
                </div>
                <div data-ev-id="ev_2fa34d9366" className="flex gap-3">
                  <Button variant="outline" fullWidth onClick={() => setConfirmDelete(null)}>
                    Cancel
                  </Button>
                  <Button variant="danger" fullWidth onClick={handleDelete}>
                    Delete
                  </Button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}