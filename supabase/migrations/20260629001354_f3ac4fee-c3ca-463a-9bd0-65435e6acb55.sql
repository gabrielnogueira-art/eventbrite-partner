
-- 1) EJ directory
CREATE TABLE IF NOT EXISTS public.ej_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  region text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ej_directory TO anon, authenticated;
GRANT ALL ON public.ej_directory TO service_role;
ALTER TABLE public.ej_directory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ej_directory readable by everyone" ON public.ej_directory;
CREATE POLICY "ej_directory readable by everyone" ON public.ej_directory FOR SELECT USING (true);
DROP POLICY IF EXISTS "ej_directory admin write" ON public.ej_directory;
CREATE POLICY "ej_directory admin write" ON public.ej_directory FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2) Caravan opt-in on participants
ALTER TABLE public.order_participants ADD COLUMN IF NOT EXISTS wants_caravan boolean NOT NULL DEFAULT false;

-- 3) Seed EJ directory
INSERT INTO public.ej_directory (name, slug, region) VALUES
('AD JÚNIOR','ad-junior','sul'),('CETA Jr.','ceta-jr','sul'),('ECOSSAM Jr','ecossam-jr','sul'),('Etica Jr.','etica-jr','sul'),
('Flora Jr.','flora-jr','sul'),('Ímpeto','impeto','sul'),('Mensurar Jr','mensurar-jr','sul'),('Multiconsultoria','multiconsultoria','sul'),
('Núcleo','nucleo','sul'),('Pulso','pulso','sul'),('Rural Consultoria','rural-consultoria','sul'),('Signal Jr.','signal-jr','sul'),
('SOLARMATERIAIS','solarmateriais','sul'),('UFFTech','ufftech','sul'),('Vale Verde SSA','vale-verde-ssa','sul'),('Vértix','vertix','sul'),
('Vital Jr','vital-jr','sul'),('XPORT Jr','xport-jr','sul'),
('Ayra','ayra','centro-sul-1'),('Destro','destro','centro-sul-1'),('Economus','economus','centro-sul-1'),('ESPM Jr','espm-jr','centro-sul-1'),
('Expand Jr.','expand-jr','centro-sul-1'),('FGV Jr.','fgv-jr','centro-sul-1'),('Ibmec Jr.','ibmec-jr','centro-sul-1'),('IME Júnior','ime-junior','centro-sul-1'),
('Insight','insight','centro-sul-1'),('Límina','limina','centro-sul-1'),('Minerva','minerva','centro-sul-1'),('Potentia','potentia','centro-sul-1'),
('Âmbar Jr','ambar-jr','centro-sul-2'),('Auger PD&I','auger-pdi','centro-sul-2'),('Carioca Jr','carioca-jr','centro-sul-2'),('CEFET Jr.','cefet-jr','centro-sul-2'),
('Conpleq','conpleq','centro-sul-2'),('EJCM','ejcm','centro-sul-2'),('Evolution','evolution','centro-sul-2'),('Expresse!','expresse','centro-sul-2'),
('Fluxo','fluxo','centro-sul-2'),('Fórmula','formula','centro-sul-2'),('Hidros','hidros','centro-sul-2'),('Iniciativa','iniciativa','centro-sul-2'),
('Legado','legado','centro-sul-2'),('MedCo','medco','centro-sul-2'),('Salto','salto','centro-sul-2'),('Titanus','titanus','centro-sul-2'),('Xisto','xisto','centro-sul-2'),
('Agrha','agrha','centro-norte'),('Ânimo','animo','centro-norte'),('Argos','argos','centro-norte'),('Eficiência Júnior','eficiencia-junior','centro-norte'),
('Env Júnior','env-junior','centro-norte'),('Fácil Consultoria','facil-consultoria','centro-norte'),('Famath Jr','famath-jr','centro-norte'),
('HealTech Júnior','healtech-junior','centro-norte'),('Horizonte','horizonte','centro-norte'),('IN Junior','in-junior','centro-norte'),
('LEVE','leve','centro-norte'),('Meta Consultoria','meta-consultoria','centro-norte'),('Opção','opcao','centro-norte'),('P&Q','pq','centro-norte'),
('Pacto','pacto','centro-norte'),('Papo Design','papo-design','centro-norte'),
('ALQUALIS','alqualis','norte'),('Aurea','aurea','norte'),('CASE Empresa Júnior','case-empresa-junior','norte'),('Catena','catena','norte'),
('ECOlagos','ecolagos','norte'),('Engloba Consultoria','engloba-consultoria','norte'),('Estratégia Jr.','estrategia-jr','norte'),
('Farmac Jr','farmac-jr','norte'),('Focus','focus','norte'),('Gestão Ativa Jr','gestao-ativa-jr','norte'),
('Lignum Ambiental Jr','lignum-ambiental-jr','norte'),('QualiVet','qualivet','norte'),('RootLocus','rootlocus','norte')
ON CONFLICT (slug) DO UPDATE SET region = EXCLUDED.region, name = EXCLUDED.name;

-- 4) Auto-fill region on new user signup from ej_directory
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ej_name text := NEW.raw_user_meta_data->>'ej_name';
  v_ej_slug text := NEW.raw_user_meta_data->>'ej_slug';
  v_region text := NEW.raw_user_meta_data->>'region';
BEGIN
  IF v_region IS NULL OR v_region = '' THEN
    SELECT region INTO v_region FROM public.ej_directory
      WHERE (v_ej_slug IS NOT NULL AND slug = v_ej_slug)
         OR (v_ej_name IS NOT NULL AND lower(name) = lower(v_ej_name))
      LIMIT 1;
  END IF;
  INSERT INTO public.profiles (id, full_name, email, ej_name, ej_slug, region)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email, v_ej_name, v_ej_slug, v_region)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
