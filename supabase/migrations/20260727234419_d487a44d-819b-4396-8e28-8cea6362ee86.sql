
-- Admin update/delete on profiles
CREATE POLICY "profiles admin update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "profiles admin delete" ON public.profiles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- EJ change requests table
CREATE TABLE public.ej_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_ej_slug text,
  current_ej_name text,
  current_region text,
  requested_ej_slug text NOT NULL,
  requested_ej_name text NOT NULL,
  requested_region text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  admin_notes text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.ej_change_requests TO authenticated;
GRANT ALL ON public.ej_change_requests TO service_role;

ALTER TABLE public.ej_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ejcr owner read" ON public.ej_change_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "ejcr owner insert" ON public.ej_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ejcr admin update" ON public.ej_change_requests
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE OR REPLACE FUNCTION public.request_ej_change(_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ej RECORD;
  _p RECORD;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _ej FROM public.ej_directory WHERE slug = _slug;
  IF NOT FOUND THEN RAISE EXCEPTION 'EJ não encontrada'; END IF;
  SELECT ej_slug, ej_name, region INTO _p FROM public.profiles WHERE id = _uid;
  IF _p.ej_slug = _slug THEN RAISE EXCEPTION 'Você já está vinculado a esta EJ'; END IF;

  -- Cancel prior pending requests for this user
  UPDATE public.ej_change_requests
     SET status = 'cancelled', updated_at = now()
   WHERE user_id = _uid AND status = 'pending';

  INSERT INTO public.ej_change_requests (
    user_id, current_ej_slug, current_ej_name, current_region,
    requested_ej_slug, requested_ej_name, requested_region
  ) VALUES (
    _uid, _p.ej_slug, _p.ej_name, _p.region,
    _ej.slug, _ej.name, _ej.region
  ) RETURNING id INTO _id;
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.approve_ej_change(_request_id uuid, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _r RECORD;
BEGIN
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _r FROM public.ej_change_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'request not pending'; END IF;

  UPDATE public.profiles
     SET ej_slug = _r.requested_ej_slug,
         ej_name = _r.requested_ej_name,
         region  = _r.requested_region
   WHERE id = _r.user_id;

  UPDATE public.ej_change_requests
     SET status = 'approved',
         admin_notes = _notes,
         resolved_by = auth.uid(),
         resolved_at = now(),
         updated_at = now()
   WHERE id = _request_id;
END; $$;

CREATE OR REPLACE FUNCTION public.reject_ej_change(_request_id uuid, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.ej_change_requests
     SET status = 'rejected',
         admin_notes = _notes,
         resolved_by = auth.uid(),
         resolved_at = now(),
         updated_at = now()
   WHERE id = _request_id AND status = 'pending';
END; $$;

REVOKE EXECUTE ON FUNCTION public.request_ej_change(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_ej_change(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_ej_change(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_ej_change(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_ej_change(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_ej_change(uuid, text) TO authenticated;
