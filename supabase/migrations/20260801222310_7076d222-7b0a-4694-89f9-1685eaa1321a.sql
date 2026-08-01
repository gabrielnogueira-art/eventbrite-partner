-- Recalc both reserved and sold from orders (single source of truth)
CREATE OR REPLACE FUNCTION public.recalc_lot_reserved(_lot_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE public.ticket_lots l
  SET reserved_quantity = COALESCE((
        SELECT SUM(o.quantity) FROM public.orders o
        WHERE o.lot_id = l.id
          AND (o.status = 'awaiting_review'
            OR (o.status = 'pending' AND o.reserved_until > now()))
      ), 0),
      sold_quantity = COALESCE((
        SELECT SUM(o.quantity) FROM public.orders o
        WHERE o.lot_id = l.id AND o.status = 'paid'
      ), 0)
  WHERE l.id = _lot_id;
$function$;

-- create_reservation: no manual reserved arithmetic (trigger handles it)
CREATE OR REPLACE FUNCTION public.create_reservation(_lot_id uuid, _quantity integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _lot RECORD;
  _order_id UUID;
  _user UUID := auth.uid();
  _max INT;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.orders SET status = 'expired'
    WHERE status = 'pending' AND reserved_until < now();
  SELECT l.*, e.max_tickets_per_user INTO _lot
    FROM public.ticket_lots l JOIN public.events e ON e.id = l.event_id
    WHERE l.id = _lot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lot not found'; END IF;
  IF now() < _lot.opens_at OR now() > _lot.closes_at THEN RAISE EXCEPTION 'lot not open'; END IF;
  _max := _lot.max_tickets_per_user;
  IF _quantity < 1 OR _quantity > _max THEN RAISE EXCEPTION 'invalid quantity (max %)', _max; END IF;
  PERFORM public.recalc_lot_reserved(_lot_id);
  SELECT * INTO _lot FROM public.ticket_lots WHERE id = _lot_id;
  IF _lot.sold_quantity + _lot.reserved_quantity + _quantity > _lot.total_quantity THEN
    RAISE EXCEPTION 'not enough tickets available';
  END IF;
  INSERT INTO public.orders (user_id, event_id, lot_id, quantity, total_cents, reserved_until)
  VALUES (_user, _lot.event_id, _lot.id, _quantity, _lot.price_cents * _quantity, now() + interval '24 hours')
  RETURNING id INTO _order_id;
  RETURN _order_id;
END; $function$;

-- Payment confirmations: drop manual counters, rely on trigger recalc
CREATE OR REPLACE FUNCTION public.confirm_payment(_order_id uuid, _method payment_method)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _o RECORD;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id = _order_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _o.status <> 'pending' THEN RAISE EXCEPTION 'order not pending'; END IF;
  IF _o.reserved_until < now() THEN
    UPDATE public.orders SET status = 'expired' WHERE id = _o.id;
    RAISE EXCEPTION 'reservation expired';
  END IF;
  UPDATE public.orders SET status = 'paid', payment_method = _method, paid_at = now() WHERE id = _o.id;
END; $function$;

CREATE OR REPLACE FUNCTION public.confirm_payment_by_admin(_order_id uuid, _method payment_method, _paddle_tx text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _o RECORD;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _o.status = 'paid' THEN RETURN; END IF;
  UPDATE public.orders SET status = 'paid', payment_method = _method, paid_at = now(), paddle_transaction_id = _paddle_tx
    WHERE id = _o.id;
END; $function$;

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
  IF _kind <> 'independent' AND (_redemption_link IS NULL OR length(trim(_redemption_link)) = 0) THEN
    RAISE EXCEPTION 'redemption link required';
  END IF;
  IF _o.status = 'paid' THEN
    UPDATE public.orders SET redemption_link = NULLIF(trim(coalesce(_redemption_link,'')),''), admin_notes = COALESCE(_notes, admin_notes) WHERE id = _o.id;
    RETURN;
  END IF;
  UPDATE public.orders
    SET status = 'paid',
        payment_method = COALESCE(payment_method,'pix'),
        paid_at = now(),
        approved_at = now(),
        approved_by = auth.uid(),
        redemption_link = NULLIF(trim(coalesce(_redemption_link,'')),''),
        admin_notes = _notes
    WHERE id = _o.id;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.recalc_lot_reserved(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_reservation(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_payment(uuid, payment_method) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_payment_by_admin(uuid, payment_method, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_order_by_admin(uuid, text, text) FROM PUBLIC, anon;

-- Repair every existing lot
UPDATE public.ticket_lots l
SET reserved_quantity = COALESCE((
      SELECT SUM(o.quantity) FROM public.orders o
      WHERE o.lot_id = l.id
        AND (o.status = 'awaiting_review'
          OR (o.status = 'pending' AND o.reserved_until > now()))
    ), 0),
    sold_quantity = COALESCE((
      SELECT SUM(o.quantity) FROM public.orders o
      WHERE o.lot_id = l.id AND o.status = 'paid'
    ), 0);