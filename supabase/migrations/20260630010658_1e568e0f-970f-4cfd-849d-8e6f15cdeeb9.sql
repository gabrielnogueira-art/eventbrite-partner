
-- 1) Add 'awaiting_review' to order_status
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'awaiting_review';

-- 2) New columns on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_proof_url text,
  ADD COLUMN IF NOT EXISTS payment_proof_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS redemption_link text,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

-- 3) Global settings table (singleton: id=1)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id int PRIMARY KEY DEFAULT 1,
  pix_key text,
  pix_key_type text,
  pix_recipient_name text,
  pix_qr_url text,
  pix_instructions text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_read ON public.app_settings;
CREATE POLICY app_settings_read ON public.app_settings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS app_settings_admin_write ON public.app_settings;
CREATE POLICY app_settings_admin_write ON public.app_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- 4) RPC: submit payment proof (user)
CREATE OR REPLACE FUNCTION public.submit_payment_proof(_order_id uuid, _proof_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o RECORD;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id = _order_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _o.status NOT IN ('pending','awaiting_review') THEN
    RAISE EXCEPTION 'order not awaiting payment';
  END IF;
  UPDATE public.orders
    SET status = 'awaiting_review',
        payment_proof_url = _proof_url,
        payment_proof_submitted_at = now(),
        reserved_until = GREATEST(reserved_until, now() + interval '30 days')
    WHERE id = _order_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.submit_payment_proof(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_payment_proof(uuid, text) TO authenticated;

-- 5) RPC: admin approve order with redemption link
CREATE OR REPLACE FUNCTION public.approve_order_by_admin(
  _order_id uuid, _redemption_link text, _notes text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o RECORD;
BEGIN
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _redemption_link IS NULL OR length(trim(_redemption_link)) = 0 THEN
    RAISE EXCEPTION 'redemption link required';
  END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _o.status = 'paid' THEN
    UPDATE public.orders SET redemption_link = _redemption_link, admin_notes = COALESCE(_notes, admin_notes) WHERE id = _o.id;
    RETURN;
  END IF;
  UPDATE public.orders
    SET status = 'paid',
        payment_method = 'pix',
        paid_at = now(),
        approved_at = now(),
        approved_by = auth.uid(),
        redemption_link = _redemption_link,
        admin_notes = _notes
    WHERE id = _o.id;
  UPDATE public.ticket_lots
    SET sold_quantity = sold_quantity + _o.quantity,
        reserved_quantity = GREATEST(reserved_quantity - _o.quantity, 0)
    WHERE id = _o.lot_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.approve_order_by_admin(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_order_by_admin(uuid, text, text) TO authenticated;

-- 6) RPC: admin reject proof
CREATE OR REPLACE FUNCTION public.reject_payment_proof(_order_id uuid, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.orders
    SET status = 'pending',
        payment_proof_url = NULL,
        payment_proof_submitted_at = NULL,
        admin_notes = _notes,
        reserved_until = now() + interval '7 days'
    WHERE id = _order_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.reject_payment_proof(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_payment_proof(uuid, text) TO authenticated;

-- 7) Patch create_reservation: don't auto-expire awaiting_review; longer pending window
CREATE OR REPLACE FUNCTION public.create_reservation(_lot_id uuid, _quantity integer)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  _lot RECORD;
  _order_id UUID;
  _user UUID := auth.uid();
  _max INT;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.orders SET status = 'expired'
    WHERE status = 'pending' AND reserved_until < now();
  SELECT l.*, e.max_tickets_per_user, e.id AS evt_id INTO _lot
    FROM public.ticket_lots l JOIN public.events e ON e.id = l.event_id
    WHERE l.id = _lot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lot not found'; END IF;
  IF now() < _lot.opens_at OR now() > _lot.closes_at THEN RAISE EXCEPTION 'lot not open'; END IF;
  _max := _lot.max_tickets_per_user;
  IF _quantity < 1 OR _quantity > _max THEN RAISE EXCEPTION 'invalid quantity (max %)', _max; END IF;
  UPDATE public.ticket_lots
    SET reserved_quantity = COALESCE((SELECT SUM(quantity) FROM public.orders WHERE lot_id = _lot.id AND status IN ('pending','awaiting_review')), 0)
    WHERE id = _lot.id;
  SELECT * INTO _lot FROM public.ticket_lots WHERE id = _lot_id;
  IF _lot.sold_quantity + _lot.reserved_quantity + _quantity > _lot.total_quantity THEN
    RAISE EXCEPTION 'not enough tickets available';
  END IF;
  INSERT INTO public.orders (user_id, event_id, lot_id, quantity, total_cents, reserved_until)
  VALUES (_user, _lot.event_id, _lot.id, _quantity, _lot.price_cents * _quantity, now() + interval '24 hours')
  RETURNING id INTO _order_id;
  UPDATE public.ticket_lots SET reserved_quantity = reserved_quantity + _quantity WHERE id = _lot.id;
  RETURN _order_id;
END; $function$;
