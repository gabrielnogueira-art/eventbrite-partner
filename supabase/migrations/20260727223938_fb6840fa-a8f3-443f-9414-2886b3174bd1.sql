ALTER TABLE public.events ADD COLUMN IF NOT EXISTS caravan_regions text[] NOT NULL DEFAULT '{}';
-- Backfill: eventos existentes ganham Norte e Sul por padrão (comportamento antigo)
UPDATE public.events SET caravan_regions = ARRAY['Norte','Sul'] WHERE caravan_regions = '{}';