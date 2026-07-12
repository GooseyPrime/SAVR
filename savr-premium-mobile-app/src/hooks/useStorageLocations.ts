import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/helpers';

export type StorageLocation = Tables<'user_storage_locations'>;
export type StorageLocationInsert = TablesInsert<'user_storage_locations'>;
export type StorageCondition = Tables<'storage_conditions'>;

interface UseStorageLocationsReturn {
  locations: StorageLocation[];
  conditions: StorageCondition[];
  isLoading: boolean;
  error: string | null;
  createLocation: (data: Omit<StorageLocationInsert, 'user_id'>) => Promise<StorageLocation | null>;
  updateLocation: (id: string, data: Partial<StorageLocationInsert>) => Promise<boolean>;
  deleteLocation: (id: string) => Promise<boolean>;
  reorderLocations: (orderedIds: string[]) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useStorageLocations(): UseStorageLocationsReturn {
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [conditions, setConditions] = useState<StorageCondition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    if (!supabase) {
      setError('Database not connected');
      setIsLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLocations([]);
        setIsLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('user_storage_locations')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setLocations(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch locations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchConditions = useCallback(async () => {
    if (!supabase) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('storage_conditions')
        .select('*')
        .order('label');

      if (fetchError) throw fetchError;
      setConditions(data || []);
    } catch (err) {
      console.error('Failed to fetch conditions:', err);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
    fetchConditions();
  }, [fetchLocations, fetchConditions]);

  const createLocation = async (data: Omit<StorageLocationInsert, 'user_id'>): Promise<StorageLocation | null> => {
    if (!supabase) {
      setError('Database not connected');
      return null;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Not authenticated');
        return null;
      }

      const { data: newLocation, error: insertError } = await supabase
        .from('user_storage_locations')
        .insert({
          ...data,
          user_id: user.id,
          sort_order: locations.length,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      
      setLocations(prev => [...prev, newLocation]);
      return newLocation;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create location');
      return null;
    }
  };

  const updateLocation = async (id: string, data: Partial<StorageLocationInsert>): Promise<boolean> => {
    if (!supabase) {
      setError('Database not connected');
      return false;
    }

    try {
      const { error: updateError } = await supabase
        .from('user_storage_locations')
        .update(data)
        .eq('id', id);

      if (updateError) throw updateError;
      
      setLocations(prev => prev.map(loc => 
        loc.id === id ? { ...loc, ...data } as StorageLocation : loc
      ));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update location');
      return false;
    }
  };

  const deleteLocation = async (id: string): Promise<boolean> => {
    if (!supabase) {
      setError('Database not connected');
      return false;
    }

    try {
      const { error: deleteError } = await supabase
        .from('user_storage_locations')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      
      setLocations(prev => prev.filter(loc => loc.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete location');
      return false;
    }
  };

  const reorderLocations = async (orderedIds: string[]): Promise<boolean> => {
    if (!supabase) return false;

    try {
      const updates = orderedIds.map((id, index) => 
        supabase
          .from('user_storage_locations')
          .update({ sort_order: index })
          .eq('id', id)
      );

      await Promise.all(updates);
      
      setLocations(prev => {
        const sorted = [...prev].sort((a, b) => 
          orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id)
        );
        return sorted.map((loc, i) => ({ ...loc, sort_order: i }));
      });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder');
      return false;
    }
  };

  return {
    locations,
    conditions,
    isLoading,
    error,
    createLocation,
    updateLocation,
    deleteLocation,
    reorderLocations,
    refresh: fetchLocations,
  };
}
