
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_region_check;

UPDATE public.profiles SET region = 'Sul' WHERE region IN ('sul','Sul');
UPDATE public.profiles SET region = 'Norte' WHERE region IN ('norte','Norte');
UPDATE public.profiles SET region = 'Centro Sul 2' WHERE region IN ('sudeste','nordeste','centro_oeste');

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_region_check
  CHECK (region IS NULL OR region IN ('Norte','Centro Norte','Centro Sul 1','Centro Sul 2','Sul'));
