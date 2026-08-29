'use client';

import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import { useState, useEffect } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  getInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  type InventoryItem as DBInventoryItem
} from '@/lib/db';
import { callApi } from '@/lib/api';
import { pantryNotesFromScan, pantryCategory } from '@/lib/pantryPersist';
import type { NutritionalInfo } from '@/lib/types/functions';

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: 'pantry' | 'fridge' | 'freezer';
  expiryDate?: string;
  imageUrl?: string | null;
  addedDate?: string;
}

export default function InventoryPage() {
  return (
    <ProtectedRoute>
      <InventoryContent />
    </ProtectedRoute>
  );
}

function InventoryContent() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [newItem, setNewItem] = useState<Omit<InventoryItem, 'id'>>({
    name: '',
    quantity: 1,
    unit: '',
    category: 'pantry',
  });
  const [error, setError] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeError, setBarcodeError] = useState('');

  useEffect(() => {
    loadInventory();
  }, [user]);

  async function loadInventory() {
    if (!user) return;

    try {
      const data = await getInventory(user.id);
      const inventoryItems = data.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        expiryDate: item.expiry_date,
        imageUrl: item.image_url,
        addedDate: item.created_at,
      } as InventoryItem));
      setItems(inventoryItems);
    } catch (error) {
      console.error('Error loading inventory:', error);
      setError('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddItem() {
    if (!user || !newItem.name.trim()) return;

    try {
      const addedItem = await addInventoryItem(user.id, {
        name: newItem.name.trim(),
        quantity: newItem.quantity,
        unit: newItem.unit.trim(),
        category: newItem.category,
        image_url: newItem.imageUrl || undefined,
      });

      setItems([
        ...items,
        {
          id: addedItem.id,
          name: addedItem.name,
          quantity: addedItem.quantity,
          unit: addedItem.unit,
          category: addedItem.category as 'pantry' | 'fridge' | 'freezer',
          expiryDate: addedItem.expiry_date,
          imageUrl: addedItem.image_url,
          addedDate: addedItem.created_at,
        },
      ]);

      setNewItem({
        name: '',
        quantity: 1,
        unit: '',
        category: 'pantry',
      });
    } catch (err) {
      console.error('Error adding item:', err);
      setError('Failed to add item');
    }
  }

  async function handleDeleteItem(itemId: string) {
    try {
      await deleteInventoryItem(itemId);
      setItems(items.filter(item => item.id !== itemId));
    } catch (error) {
      console.error('Error deleting item:', error);
      setError('Failed to delete item');
    }
  }

  async function handleBarcodeLookup() {
    const code = barcodeInput.trim().replace(/\D/g, '');
    if (!code || !user) return;
    setBarcodeLoading(true);
    setBarcodeError('');
    try {
      const result = await callApi('/nutrition/lookup', { barcode: code });
      const data = result as {
        success: boolean;
        hit: {
          name?: string;
          brand?: string;
          barcode?: string;
          nutrition?: NutritionalInfo;
          source?: string;
          packageSize?: string;
        } | null;
      };
      if (!data.hit || !data.hit.name) {
        setBarcodeError('Product not found. Try another barcode.');
        setBarcodeLoading(false);
        return;
      }

      const hit = data.hit;
      const notes = pantryNotesFromScan({
        nutrition: hit.nutrition,
        nutritionSource: hit.source,
        barcode: hit.barcode ?? code,
        packageSize: hit.packageSize,
      });

      // Parse packageSize (e.g. "500 g", "1.5 kg", "12 oz") into quantity + unit.
      // Fall back to 1 / 'unit' when the field is absent or unparseable.
      let parsedQuantity = 1;
      let parsedUnit = 'unit';
      if (hit.packageSize) {
        const match = hit.packageSize.match(/^(\d*\.?\d+)\s*([a-zA-Z]+)/);
        if (match) {
          const num = parseFloat(match[1]);
          if (!Number.isNaN(num)) {
            parsedQuantity = num;
            parsedUnit = match[2].toLowerCase();
          }
        }
      }

      const addedItem = await addInventoryItem(user.id, {
        name: hit.name!,
        quantity: parsedQuantity,
        unit: parsedUnit,
        category: pantryCategory(undefined),
        notes,
      });

      setItems([
        ...items,
        {
          id: addedItem.id,
          name: addedItem.name,
          quantity: addedItem.quantity,
          unit: addedItem.unit,
          category: addedItem.category as 'pantry' | 'fridge' | 'freezer',
          addedDate: addedItem.created_at,
        },
      ]);
      setBarcodeInput('');
    } catch (err) {
      console.error('Barcode lookup error:', err);
      setBarcodeError('Lookup failed. Check the barcode or try again.');
    } finally {
      setBarcodeLoading(false);
    }
  }

  async function handleUpdateItem(item: InventoryItem) {
    try {
      await updateInventoryItem(item.id, {
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        expiry_date: item.expiryDate,
        image_url: item.imageUrl || undefined,
      });
      setItems(items.map(i => i.id === item.id ? item : i));
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating item:', error);
      setError('Failed to update item');
    }
  }

  async function handleQuickAdjust(itemId: string, delta: number) {
    const item = items.find(i => i.id === itemId);
    if (!item || !user) return;
    const newQuantity = Math.max(0, item.quantity + delta);
    // Optimistically update UI
    setItems(items.map(i => i.id === itemId ? { ...i, quantity: newQuantity } : i));
    try {
      if (newQuantity <= 0) {
        await deleteInventoryItem(itemId);
        setItems(prev => prev.filter(i => i.id !== itemId));
      } else {
        await updateInventoryItem(itemId, { quantity: newQuantity });
      }
    } catch (err) {
      console.error('Error adjusting quantity:', err);
      // Revert on failure
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity: item.quantity } : i));
      setError('Failed to update quantity');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-8 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Inventory Management</h1>
        <p className="text-foreground-muted text-sm mb-4">
          Your ingredients are listed below. You can add items manually, scan a barcode, or{' '}
          <a href="/upload" className="text-primary hover:underline">upload a photo</a> for AI detection.
          Tap <span className="font-semibold text-foreground">Edit</span> on any item to correct its name, quantity, or category.
        </p>
        <div className="rounded-xl px-5 py-4 mb-6 text-sm bg-primary/5 border border-primary/20">
          <p className="font-semibold text-primary mb-1">AI import not quite right?</p>
          <p className="text-foreground-muted">
            If an uploaded photo missed items or got quantities wrong, just use the <span className="font-semibold text-foreground">Edit</span> button
            to fix them, or <span className="font-semibold text-foreground">Add Item Manually</span> below to fill in anything that was missed.
            You can also delete incorrect entries and re-add them.
          </p>
        </div>

        {error && (
          <div className="border border-red-500/20 bg-red-500/10 text-red-400 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Add by barcode */}
        <div className="glass-card rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Add by barcode
          </h2>
          <p className="text-sm text-foreground-muted mb-3">
            Enter a product barcode to add it from the Open Food Facts database.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="e.g. 3017620422003"
              className="rounded-md border border-border px-3 py-2 w-48 bg-surface-raised/50 text-foreground"
            />
            <button
              type="button"
              onClick={handleBarcodeLookup}
              disabled={barcodeLoading || !barcodeInput.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              {barcodeLoading ? 'Looking up...' : 'Look up & add'}
            </button>
          </div>
          {barcodeError && (
            <p className="mt-2 text-sm text-red-400">{barcodeError}</p>
          )}
        </div>

        {/* Manual Add Section */}
        <div className="glass-card rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Add Item Manually
          </h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-foreground-muted">Name</label>
              <input
                type="text"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className="w-full rounded-md border border-border px-3 py-2 bg-surface-raised/50 text-foreground"
                placeholder="e.g., Chicken breast"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground-muted">Quantity</label>
              <input
                type="number"
                min={0}
                value={newItem.quantity}
                onChange={(e) =>
                  setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })
                }
                className="w-full rounded-md border border-border px-3 py-2 bg-surface-raised/50 text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground-muted">Unit</label>
              <input
                type="text"
                value={newItem.unit}
                onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                className="w-full rounded-md border border-border px-3 py-2 bg-surface-raised/50 text-foreground"
                placeholder="e.g., pcs, kg"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end">
            <div className="md:w-48">
              <label className="mb-1 block text-sm font-medium text-foreground-muted">Category</label>
              <select
                value={newItem.category}
                onChange={(e) =>
                  setNewItem({
                    ...newItem,
                    category: e.target.value as InventoryItem['category'],
                  })
                }
                className="w-full rounded-md border border-border px-3 py-2 bg-surface-raised/50 text-foreground"
              >
                <option value="pantry">Pantry</option>
                <option value="fridge">Fridge</option>
                <option value="freezer">Freezer</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="mt-2 inline-flex items-center rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover md:mt-0"
            >
              Add Item
            </button>
          </div>
        </div>

        {/* Inventory List */}
        <div className="glass-card rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Current Inventory ({items.length} items)
          </h2>
          
          {items.length === 0 ? (
            <div className="text-center py-12 text-foreground-muted">
              <p className="text-lg mb-2">No items in inventory yet</p>
              <p className="text-sm">Upload a photo to get started!</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(item => (
                <InventoryCard
                  key={item.id}
                  item={item}
                  onDelete={handleDeleteItem}
                  onEdit={setEditingItem}
                  onQuickAdjust={handleQuickAdjust}
                />
              ))}
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {editingItem && (
          <EditModal
            item={editingItem}
            onSave={handleUpdateItem}
            onClose={() => setEditingItem(null)}
          />
        )}
      </div>
    </div>
  );
}

function InventoryCard({
  item,
  onDelete,
  onEdit,
  onQuickAdjust,
}: {
  item: InventoryItem;
  onDelete: (id: string) => void;
  onEdit: (item: InventoryItem) => void;
  onQuickAdjust: (id: string, delta: number) => void;
}) {
  return (
    <div className="border border-border rounded-lg p-4 hover:border-primary/30 transition glass-card">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-foreground">{item.name}</h3>
        <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded">
          {item.category}
        </span>
      </div>
      {/* Quick +/- stepper */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => onQuickAdjust(item.id, -1)}
          disabled={item.quantity <= 0}
          className="w-8 h-8 flex items-center justify-center rounded-md bg-white/10 text-foreground font-bold hover:bg-red-500/30 hover:text-red-300 disabled:opacity-30 transition"
        >
          -
        </button>
        <span className="text-foreground font-medium min-w-[60px] text-center">
          {item.quantity} {item.unit}
        </span>
        <button
          onClick={() => onQuickAdjust(item.id, 1)}
          className="w-8 h-8 flex items-center justify-center rounded-md bg-white/10 text-foreground font-bold hover:bg-green-500/30 hover:text-green-300 transition"
        >
          +
        </button>
      </div>
      {item.expiryDate && (
        <p className="text-sm text-foreground-muted mb-3">
          Expires: {new Date(item.expiryDate).toLocaleDateString()}
        </p>
      )}
      <div className="flex space-x-2">
        <button
          onClick={() => onEdit(item)}
          className="flex-1 px-3 py-1 text-sm bg-primary text-primary-foreground font-semibold rounded hover:bg-primary-hover transition"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="flex-1 px-3 py-1 text-sm bg-red-600 text-foreground rounded hover:bg-red-700 transition"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function EditModal({ 
  item, 
  onSave, 
  onClose 
}: { 
  item: InventoryItem; 
  onSave: (item: InventoryItem) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState(item);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="glass-card rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-bold text-foreground mb-4">Edit Item</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground-muted mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-md bg-surface-raised/50 text-foreground"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground-muted mb-1">Quantity</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-md bg-surface-raised/50 text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-muted mb-1">Unit</label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md bg-surface-raised/50 text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground-muted mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as 'pantry' | 'fridge' | 'freezer' })}
              className="w-full px-3 py-2 border border-border rounded-md bg-surface-raised/50 text-foreground"
            >
              <option value="pantry">Pantry</option>
              <option value="fridge">Fridge</option>
              <option value="freezer">Freezer</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground-muted mb-1">Expiry Date (optional)</label>
            <input
              type="date"
              value={formData.expiryDate || ''}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-md bg-surface-raised/50 text-foreground"
            />
          </div>
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            onClick={() => onSave(formData)}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary-hover"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-700 text-foreground rounded-md hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
