-- Storage Locations System for SAVR
-- Each user can create their own named storage locations with conditions
-- Data is kept private per user via RLS

-- Storage conditions reference table (public read)
CREATE TABLE IF NOT EXISTS public.storage_conditions (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  temp_range TEXT
);

-- Insert default storage conditions (ignore if exists)
INSERT INTO public.storage_conditions (id, label, description, icon, temp_range) VALUES
  ('room_temp', 'Room Temperature', 'Dry storage at ambient temperature', 'thermometer', '60-75°F'),
  ('refrigerated', 'Refrigerated', 'Cold storage, typically 35-40°F', 'thermometer-snowflake', '35-40°F'),
  ('frozen', 'Frozen', 'Freezer storage, 0°F or below', 'snowflake', '0°F or below'),
  ('cool_dark', 'Cool & Dark', 'Cool pantry or cellar storage', 'moon', '50-60°F'),
  ('humidity_controlled', 'Humidity Controlled', 'For items needing specific humidity', 'droplets', 'Varies')
ON CONFLICT (id) DO NOTHING;

-- RLS for storage_conditions (public read)
ALTER TABLE public.storage_conditions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read storage conditions" ON public.storage_conditions;
CREATE POLICY "Anyone can read storage conditions"
  ON public.storage_conditions
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- User's custom storage locations
CREATE TABLE IF NOT EXISTS public.user_storage_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  conditions TEXT[] NOT NULL DEFAULT '{}',
  icon TEXT DEFAULT 'package',
  color TEXT DEFAULT '#FFB800',
  sort_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_location_name_per_user UNIQUE (user_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_storage_locations_user_id ON public.user_storage_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_storage_locations_sort ON public.user_storage_locations(user_id, sort_order);

-- RLS for user_storage_locations (owner-only)
ALTER TABLE public.user_storage_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own storage locations" ON public.user_storage_locations;
CREATE POLICY "Users can view their own storage locations"
  ON public.user_storage_locations FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own storage locations" ON public.user_storage_locations;
CREATE POLICY "Users can create their own storage locations"
  ON public.user_storage_locations FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own storage locations" ON public.user_storage_locations;
CREATE POLICY "Users can update their own storage locations"
  ON public.user_storage_locations FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own storage locations" ON public.user_storage_locations;
CREATE POLICY "Users can delete their own storage locations"
  ON public.user_storage_locations FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- User's inventory items with storage location reference
CREATE TABLE IF NOT EXISTS public.user_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_location_id UUID REFERENCES public.user_storage_locations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  expires_at TIMESTAMP WITH TIME ZONE,
  purchased_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  barcode TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for inventory
CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON public.user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_location ON public.user_inventory(storage_location_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_category ON public.user_inventory(user_id, category);
CREATE INDEX IF NOT EXISTS idx_user_inventory_expires ON public.user_inventory(user_id, expires_at);

-- RLS for user_inventory (owner-only)
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own inventory" ON public.user_inventory;
CREATE POLICY "Users can view their own inventory"
  ON public.user_inventory FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can add to their own inventory" ON public.user_inventory;
CREATE POLICY "Users can add to their own inventory"
  ON public.user_inventory FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own inventory" ON public.user_inventory;
CREATE POLICY "Users can update their own inventory"
  ON public.user_inventory FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete from their own inventory" ON public.user_inventory;
CREATE POLICY "Users can delete from their own inventory"
  ON public.user_inventory FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Add storage_setup_completed to profiles if not exists
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS storage_setup_completed BOOLEAN DEFAULT false;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_user_storage_locations_updated_at ON public.user_storage_locations;
CREATE TRIGGER update_user_storage_locations_updated_at
  BEFORE UPDATE ON public.user_storage_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_inventory_updated_at ON public.user_inventory;
CREATE TRIGGER update_user_inventory_updated_at
  BEFORE UPDATE ON public.user_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();