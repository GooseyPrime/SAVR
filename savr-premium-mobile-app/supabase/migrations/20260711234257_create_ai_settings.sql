-- AI Provider settings table (for future user-configurable API keys)
CREATE TABLE public.user_ai_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  preferred_provider TEXT DEFAULT 'openrouter' CHECK (preferred_provider IN ('openrouter', 'anthropic', 'openai', 'google')),
  preferred_model TEXT,
  custom_temperature NUMERIC(2,1) CHECK (custom_temperature >= 0 AND custom_temperature <= 2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for user lookup
CREATE INDEX idx_user_ai_settings_user ON public.user_ai_settings(user_id);

-- Enable RLS
ALTER TABLE public.user_ai_settings ENABLE ROW LEVEL SECURITY;

-- Policies: users can only access their own settings
CREATE POLICY "Users can view own AI settings" ON public.user_ai_settings
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own AI settings" ON public.user_ai_settings
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own AI settings" ON public.user_ai_settings
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_ai_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_ai_settings_updated_at
  BEFORE UPDATE ON public.user_ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_settings_updated_at();