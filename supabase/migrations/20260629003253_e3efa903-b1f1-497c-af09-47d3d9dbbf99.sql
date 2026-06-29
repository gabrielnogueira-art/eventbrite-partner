
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paddle_transaction_id text;
CREATE INDEX IF NOT EXISTS idx_orders_paddle_tx ON public.orders(paddle_transaction_id);

CREATE OR REPLACE FUNCTION public.confirm_payment_by_admin(_order_id uuid, _method payment_method, _paddle_tx text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o RECORD;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _o.status = 'paid' THEN RETURN; END IF;
  UPDATE public.orders SET status = 'paid', payment_method = _method, paid_at = now(), paddle_transaction_id = _paddle_tx
    WHERE id = _o.id;
  UPDATE public.ticket_lots
    SET sold_quantity = sold_quantity + _o.quantity,
        reserved_quantity = GREATEST(reserved_quantity - _o.quantity, 0)
    WHERE id = _o.lot_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.confirm_payment_by_admin(uuid, payment_method, text) FROM PUBLIC, anon, authenticated;
