
-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  organizer TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  location_name TEXT,
  address TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  cancellation_policy TEXT,
  max_tickets_per_user INT NOT NULL DEFAULT 5,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.events TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events public read" ON public.events FOR SELECT USING (true);
CREATE POLICY "events admin write" ON public.events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Ticket lots
CREATE TABLE public.ticket_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_cents INT NOT NULL,
  total_quantity INT NOT NULL,
  sold_quantity INT NOT NULL DEFAULT 0,
  reserved_quantity INT NOT NULL DEFAULT 0,
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ticket_lots TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.ticket_lots TO authenticated;
GRANT ALL ON public.ticket_lots TO service_role;
ALTER TABLE public.ticket_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lots public read" ON public.ticket_lots FOR SELECT USING (true);
CREATE POLICY "lots admin write" ON public.ticket_lots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Orders
CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'expired', 'cancelled');
CREATE TYPE public.payment_method AS ENUM ('pix', 'credit_card');

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES public.ticket_lots(id) ON DELETE CASCADE,
  quantity INT NOT NULL CHECK (quantity > 0),
  status public.order_status NOT NULL DEFAULT 'pending',
  payment_method public.payment_method,
  total_cents INT NOT NULL,
  reserved_until TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  billing_doc_type TEXT,
  billing_doc TEXT,
  billing_phone TEXT,
  billing_zip TEXT,
  billing_street TEXT,
  billing_number TEXT,
  billing_district TEXT,
  billing_state TEXT,
  billing_city TEXT,
  billing_complement TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders owner read" ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "orders owner insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orders owner update" ON public.orders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Participants
CREATE TABLE public.order_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_participants TO authenticated;
GRANT ALL ON public.order_participants TO service_role;
ALTER TABLE public.order_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants via order" ON public.order_participants FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

-- RPC: create reservation atomically
CREATE OR REPLACE FUNCTION public.create_reservation(_lot_id UUID, _quantity INT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _lot RECORD;
  _event_id UUID;
  _order_id UUID;
  _user UUID := auth.uid();
  _max INT;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  -- expire stale pending orders first
  UPDATE public.orders SET status = 'expired' WHERE status = 'pending' AND reserved_until < now();

  SELECT l.*, e.max_tickets_per_user, e.id AS evt_id INTO _lot
  FROM public.ticket_lots l JOIN public.events e ON e.id = l.event_id
  WHERE l.id = _lot_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'lot not found'; END IF;
  IF now() < _lot.opens_at OR now() > _lot.closes_at THEN RAISE EXCEPTION 'lot not open'; END IF;
  _max := _lot.max_tickets_per_user;
  IF _quantity < 1 OR _quantity > _max THEN RAISE EXCEPTION 'invalid quantity (max %)', _max; END IF;

  -- Recompute reserved from active pending orders
  UPDATE public.ticket_lots
    SET reserved_quantity = COALESCE((SELECT SUM(quantity) FROM public.orders WHERE lot_id = _lot.id AND status = 'pending'), 0)
    WHERE id = _lot.id;

  SELECT * INTO _lot FROM public.ticket_lots WHERE id = _lot_id;
  IF _lot.sold_quantity + _lot.reserved_quantity + _quantity > _lot.total_quantity THEN
    RAISE EXCEPTION 'not enough tickets available';
  END IF;

  INSERT INTO public.orders (user_id, event_id, lot_id, quantity, total_cents, reserved_until)
  VALUES (_user, _lot.event_id, _lot.id, _quantity, _lot.price_cents * _quantity, now() + interval '15 minutes')
  RETURNING id INTO _order_id;

  UPDATE public.ticket_lots SET reserved_quantity = reserved_quantity + _quantity WHERE id = _lot.id;
  RETURN _order_id;
END; $$;

-- RPC: confirm payment (mock)
CREATE OR REPLACE FUNCTION public.confirm_payment(_order_id UUID, _method public.payment_method)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o RECORD;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id = _order_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _o.status <> 'pending' THEN RAISE EXCEPTION 'order not pending'; END IF;
  IF _o.reserved_until < now() THEN
    UPDATE public.orders SET status = 'expired' WHERE id = _o.id;
    UPDATE public.ticket_lots SET reserved_quantity = GREATEST(reserved_quantity - _o.quantity, 0) WHERE id = _o.lot_id;
    RAISE EXCEPTION 'reservation expired';
  END IF;
  UPDATE public.orders SET status = 'paid', payment_method = _method, paid_at = now() WHERE id = _o.id;
  UPDATE public.ticket_lots SET sold_quantity = sold_quantity + _o.quantity, reserved_quantity = GREATEST(reserved_quantity - _o.quantity, 0) WHERE id = _o.lot_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.create_reservation(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment(UUID, public.payment_method) TO authenticated;
