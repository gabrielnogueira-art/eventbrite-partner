
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'refunded';

CREATE OR REPLACE FUNCTION public.refund_order_by_admin(_order_id uuid, _paddle_tx text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o RECORD;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _o.status = 'refunded' THEN RETURN; END IF;

  IF _o.status = 'paid' THEN
    UPDATE public.ticket_lots
       SET sold_quantity = GREATEST(sold_quantity - _o.quantity, 0)
     WHERE id = _o.lot_id;
  ELSIF _o.status = 'pending' THEN
    UPDATE public.ticket_lots
       SET reserved_quantity = GREATEST(reserved_quantity - _o.quantity, 0)
     WHERE id = _o.lot_id;
  END IF;

  DELETE FROM public.order_participants WHERE order_id = _o.id;
  UPDATE public.orders
     SET status = 'refunded',
         paddle_transaction_id = COALESCE(_paddle_tx, paddle_transaction_id)
   WHERE id = _o.id;
END; $$;

CREATE OR REPLACE FUNCTION public.fail_order_by_admin(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o RECORD;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _o.status <> 'pending' THEN RETURN; END IF;
  UPDATE public.orders SET status = 'failed' WHERE id = _o.id;
  UPDATE public.ticket_lots
     SET reserved_quantity = GREATEST(reserved_quantity - _o.quantity, 0)
   WHERE id = _o.lot_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.refund_order_by_admin(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_order_by_admin(uuid) FROM PUBLIC, anon, authenticated;
