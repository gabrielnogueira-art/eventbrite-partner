CREATE OR REPLACE FUNCTION public.create_reservation(_lot_id uuid, _quantity integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  VALUES (_user, _lot.event_id, _lot.id, _quantity, _lot.price_cents * _quantity, now() + interval '30 minutes')
  RETURNING id INTO _order_id;
  RETURN _order_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.create_reservation(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_reservation(uuid, integer) TO authenticated;

-- libera reservas antigas presas (mais de 30 min sem pagamento/comprovante)
UPDATE public.orders SET status = 'expired'
 WHERE status = 'pending' AND created_at < now() - interval '30 minutes';

-- recalcula todos os lotes
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT id FROM public.ticket_lots LOOP
    PERFORM public.recalc_lot_reserved(r.id);
  END LOOP;
END $$;