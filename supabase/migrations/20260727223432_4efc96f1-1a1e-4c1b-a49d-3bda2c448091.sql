
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS caravan_regions text[] NOT NULL DEFAULT '{}';

-- Allow anon SELECT on ej_directory so OAuth onboarding can list EJs before profile is created
GRANT SELECT ON public.ej_directory TO anon;
