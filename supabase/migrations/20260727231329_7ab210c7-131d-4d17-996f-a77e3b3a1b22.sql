
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_kind text NOT NULL DEFAULT 'portal_bj';
ALTER TABLE public.ticket_lots ADD COLUMN IF NOT EXISTS assigned_ej_slug text;

DROP POLICY IF EXISTS "lots public read" ON public.ticket_lots;
CREATE POLICY "lots visibility"
  ON public.ticket_lots FOR SELECT
  TO public
  USING (
    assigned_ej_slug IS NULL
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.ej_slug = ticket_lots.assigned_ej_slug
    )
  );

CREATE OR REPLACE FUNCTION public.approve_order_by_admin(_order_id uuid, _redemption_link text, _notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _o RECORD; _kind text;
BEGIN
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  SELECT event_kind INTO _kind FROM public.events WHERE id = _o.event_id;
  IF _kind IS DISTINCT FROM 'independent' THEN
    IF _redemption_link IS NULL OR length(trim(_redemption_link)) = 0 THEN
      RAISE EXCEPTION 'redemption link required';
    END IF;
  END IF;
  IF _o.status = 'paid' THEN
    UPDATE public.orders SET redemption_link = COALESCE(NULLIF(trim(_redemption_link),''), redemption_link),
                             admin_notes = COALESCE(_notes, admin_notes)
     WHERE id = _o.id;
    RETURN;
  END IF;
  UPDATE public.orders
    SET status = 'paid',
        payment_method = COALESCE(payment_method, 'pix'),
        paid_at = now(),
        approved_at = now(),
        approved_by = auth.uid(),
        redemption_link = NULLIF(trim(_redemption_link),''),
        admin_notes = _notes
    WHERE id = _o.id;
  UPDATE public.ticket_lots
    SET sold_quantity = sold_quantity + _o.quantity,
        reserved_quantity = GREATEST(reserved_quantity - _o.quantity, 0)
    WHERE id = _o.lot_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.submit_credit_card_review(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _o RECORD;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id = _order_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _o.status NOT IN ('pending','awaiting_review') THEN
    RAISE EXCEPTION 'order not awaiting payment';
  END IF;
  UPDATE public.orders
    SET status = 'awaiting_review',
        payment_method = 'credit_card',
        payment_proof_url = NULL,
        payment_proof_submitted_at = now(),
        reserved_until = GREATEST(reserved_until, now() + interval '30 days')
   WHERE id = _order_id;
END; $function$;
