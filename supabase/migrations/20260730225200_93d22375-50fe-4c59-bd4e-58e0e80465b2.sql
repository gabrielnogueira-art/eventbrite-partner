-- 1) Form builder schema + answers
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS form_schema jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.order_participants ADD COLUMN IF NOT EXISTS custom_answers jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications owner read" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "notifications owner update" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3) Reserved quantity self-healing
CREATE OR REPLACE FUNCTION public.recalc_lot_reserved(_lot_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.ticket_lots l
  SET reserved_quantity = COALESCE((
    SELECT SUM(o.quantity) FROM public.orders o
    WHERE o.lot_id = l.id
      AND (o.status = 'awaiting_review'
        OR (o.status = 'pending' AND o.reserved_until > now()))
  ), 0)
  WHERE l.id = _lot_id;
$$;
REVOKE ALL ON FUNCTION public.recalc_lot_reserved(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.orders_sync_reserved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_lot_reserved(OLD.lot_id);
    RETURN OLD;
  END IF;
  PERFORM public.recalc_lot_reserved(NEW.lot_id);
  IF TG_OP = 'UPDATE' AND NEW.lot_id IS DISTINCT FROM OLD.lot_id THEN
    PERFORM public.recalc_lot_reserved(OLD.lot_id);
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.orders_sync_reserved() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_orders_sync_reserved ON public.orders;
CREATE TRIGGER trg_orders_sync_reserved
AFTER INSERT OR UPDATE OF status, quantity, lot_id, reserved_until OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_sync_reserved();

-- expire stale pending orders and repair all lots
UPDATE public.orders SET status = 'expired' WHERE status = 'pending' AND reserved_until < now();
UPDATE public.ticket_lots l SET reserved_quantity = COALESCE((
  SELECT SUM(o.quantity) FROM public.orders o
  WHERE o.lot_id = l.id
    AND (o.status = 'awaiting_review' OR (o.status = 'pending' AND o.reserved_until > now()))
), 0);

-- 4) Delete lot with sales, notifying buyers
CREATE OR REPLACE FUNCTION public.delete_lot_by_admin(_lot_id uuid, _message text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _lot RECORD; _evt RECORD; _o RECORD;
BEGIN
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _lot FROM public.ticket_lots WHERE id = _lot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lot not found'; END IF;
  SELECT * INTO _evt FROM public.events WHERE id = _lot.event_id;

  FOR _o IN SELECT * FROM public.orders WHERE lot_id = _lot_id AND status <> 'cancelled' LOOP
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (
      _o.user_id,
      'Lote cancelado: ' || _lot.name,
      COALESCE(NULLIF(trim(_message), ''),
        'O lote "' || _lot.name || '" do evento "' || _evt.title ||
        '" foi cancelado. Sua compra foi cancelada e a organização entrará em contato em breve.')
    );
  END LOOP;

  UPDATE public.orders SET status = 'cancelled' WHERE lot_id = _lot_id AND status <> 'cancelled';
  DELETE FROM public.order_participants WHERE order_id IN (SELECT id FROM public.orders WHERE lot_id = _lot_id);
  DELETE FROM public.orders WHERE lot_id = _lot_id;
  DELETE FROM public.ticket_lots WHERE id = _lot_id;
END; $$;
REVOKE ALL ON FUNCTION public.delete_lot_by_admin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_lot_by_admin(uuid, text) TO authenticated;