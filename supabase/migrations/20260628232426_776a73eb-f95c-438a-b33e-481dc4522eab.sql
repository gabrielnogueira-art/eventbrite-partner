
-- 1. Add region to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_region_check
  CHECK (region IS NULL OR region IN ('norte','nordeste','sudeste','sul','centro_oeste'));

-- 2. transfer deadline on events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS transfer_deadline timestamptz;

-- 3. extra fields on order_participants
ALTER TABLE public.order_participants
  ADD COLUMN IF NOT EXISTS ej_owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS rg_issuer text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address_zip text,
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_district text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS university_id text,
  ADD COLUMN IF NOT EXISTS course_name text,
  ADD COLUMN IF NOT EXISTS transferred_from_ej_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transferred_at timestamptz;

-- Backfill ej_owner_id from order owner
UPDATE public.order_participants p
SET ej_owner_id = o.user_id
FROM public.orders o
WHERE p.order_id = o.id AND p.ej_owner_id IS NULL;

-- Trigger: keep ej_owner_id defaulting to order.user_id when inserted without one
CREATE OR REPLACE FUNCTION public.set_participant_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ej_owner_id IS NULL THEN
    SELECT user_id INTO NEW.ej_owner_id FROM public.orders WHERE id = NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_participant_owner() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_set_participant_owner ON public.order_participants;
CREATE TRIGGER trg_set_participant_owner
BEFORE INSERT ON public.order_participants
FOR EACH ROW EXECUTE FUNCTION public.set_participant_owner();

-- 4. RLS update: allow current ej_owner to read/update their participant rows
DROP POLICY IF EXISTS "participants via order" ON public.order_participants;
CREATE POLICY "participants read" ON public.order_participants
  FOR SELECT TO authenticated
  USING (
    ej_owner_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid())
  );
CREATE POLICY "participants insert" ON public.order_participants
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "participants update" ON public.order_participants
  FOR UPDATE TO authenticated
  USING (ej_owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (ej_owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- 5. Transfer RPC: change ej_owner to another EJ user, identified by email
CREATE OR REPLACE FUNCTION public.transfer_participant(_participant_id uuid, _target_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current uuid;
  v_order uuid;
  v_event uuid;
  v_deadline timestamptz;
  v_starts timestamptz;
  v_target uuid;
BEGIN
  SELECT ej_owner_id, order_id INTO v_current, v_order
    FROM public.order_participants WHERE id = _participant_id;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Ingresso não encontrado';
  END IF;
  IF v_current <> auth.uid() AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Você não é o titular atual deste ingresso';
  END IF;

  SELECT e.id, e.transfer_deadline, e.starts_at INTO v_event, v_deadline, v_starts
    FROM public.orders o JOIN public.events e ON e.id = o.event_id
    WHERE o.id = v_order;

  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    IF v_deadline IS NOT NULL AND now() > v_deadline THEN
      RAISE EXCEPTION 'Prazo para transferência já encerrado';
    END IF;
    IF v_deadline IS NULL AND now() > v_starts THEN
      RAISE EXCEPTION 'Evento já iniciou';
    END IF;
  END IF;

  SELECT id INTO v_target FROM auth.users WHERE lower(email) = lower(_target_email);
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'EJ destino não encontrada com este e-mail';
  END IF;
  IF v_target = v_current THEN
    RAISE EXCEPTION 'O ingresso já pertence a esta EJ';
  END IF;

  UPDATE public.order_participants
    SET ej_owner_id = v_target,
        transferred_from_ej_id = v_current,
        transferred_at = now()
    WHERE id = _participant_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.transfer_participant(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_participant(uuid, text) TO authenticated;

-- 6. Seed regions for existing test EJs
UPDATE public.profiles SET region = 'sul' WHERE ej_slug = 'poli-junior';
UPDATE public.profiles SET region = 'norte' WHERE ej_slug = 'fluxo-consultoria';
UPDATE public.profiles SET region = 'sudeste' WHERE ej_slug IN ('rio-junior','ejfgv','demo');
