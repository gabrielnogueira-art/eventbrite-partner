
-- 1) EJ field on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ej_name TEXT,
  ADD COLUMN IF NOT EXISTS ej_slug TEXT;

-- Update existing profiles
UPDATE public.profiles SET ej_name = 'Administração Portal EJ', ej_slug = 'admin' WHERE email = 'admin@portalej.test';
UPDATE public.profiles SET ej_name = 'Empresa Júnior Demo', ej_slug = 'demo' WHERE email = 'user@portalej.test';

-- Update handle_new_user to also persist ej_name from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, ej_name, ej_slug)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'ej_name',
    NEW.raw_user_meta_data->>'ej_slug'
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

-- 2) Create 4 new EJ test users
DO $$
DECLARE
  ej RECORD;
  new_id UUID;
  enc_pw TEXT;
BEGIN
  enc_pw := crypt('Senha123!', gen_salt('bf'));
  FOR ej IN
    SELECT * FROM (VALUES
      ('rio@portalej.test',     'Rio Junior',        'rio-junior',        'Equipe Rio Junior'),
      ('fluxo@portalej.test',   'Fluxo Consultoria', 'fluxo-consultoria', 'Equipe Fluxo Consultoria'),
      ('ejfgv@portalej.test',   'EJFGV',             'ejfgv',             'Equipe EJFGV'),
      ('poli@portalej.test',    'Poli Junior',       'poli-junior',       'Equipe Poli Junior')
    ) AS t(email, ej_name, ej_slug, full_name)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.email = ej.email) THEN
      new_id := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token,
        email_change_token_current, reauthentication_token, phone_change, phone_change_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
        ej.email, enc_pw, now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', ej.full_name, 'ej_name', ej.ej_name, 'ej_slug', ej.ej_slug),
        now(), now(),
        '', '', '', '', '', '', '', ''
      );
      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), new_id, jsonb_build_object('sub', new_id::text, 'email', ej.email), 'email', new_id::text, now(), now(), now())
      ON CONFLICT DO NOTHING;
      -- ensure profile row exists with EJ info (trigger may not fire on direct insert in some envs)
      INSERT INTO public.profiles (id, full_name, email, ej_name, ej_slug)
      VALUES (new_id, ej.full_name, ej.email, ej.ej_name, ej.ej_slug)
      ON CONFLICT (id) DO UPDATE SET ej_name = EXCLUDED.ej_name, ej_slug = EXCLUDED.ej_slug, full_name = EXCLUDED.full_name;
      INSERT INTO public.user_roles (user_id, role) VALUES (new_id, 'user') ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- 3) Sample events with ticket lots
DO $$
DECLARE
  evt_id UUID;
BEGIN
  -- Evento 1
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE title = 'ENEJ 2026 — Encontro Nacional de EJs') THEN
    INSERT INTO public.events (title, organizer, description, location_name, address, starts_at, ends_at, cancellation_policy, max_tickets_per_user, is_published)
    VALUES (
      'ENEJ 2026 — Encontro Nacional de EJs',
      'Brasil Júnior',
      'O maior encontro do Movimento Empresa Júnior do Brasil. Três dias de palestras, workshops e networking.',
      'Centro de Convenções SulAmérica',
      'Av. Paulo de Frontin, 1 - Cidade Nova, Rio de Janeiro - RJ',
      now() + interval '60 days', now() + interval '63 days',
      'Cancelamento até 15 dias antes do evento com reembolso integral.', 5, true
    ) RETURNING id INTO evt_id;
    INSERT INTO public.ticket_lots (event_id, name, price_cents, total_quantity, opens_at, closes_at, sort_order) VALUES
      (evt_id, '1º Lote',  29900, 100, now() - interval '5 days', now() + interval '20 days', 1),
      (evt_id, '2º Lote',  39900, 150, now() + interval '20 days', now() + interval '45 days', 2),
      (evt_id, '3º Lote',  49900, 200, now() + interval '45 days', now() + interval '60 days', 3);
  END IF;

  -- Evento 2
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE title = 'Confederação Júnior Rio — Jantar de Gala') THEN
    INSERT INTO public.events (title, organizer, description, location_name, address, starts_at, ends_at, cancellation_policy, max_tickets_per_user, is_published)
    VALUES (
      'Confederação Júnior Rio — Jantar de Gala',
      'Rio Junior',
      'Jantar de premiação das EJs do estado do Rio de Janeiro com presença de patrocinadores e mentores.',
      'Copacabana Palace',
      'Av. Atlântica, 1702 - Copacabana, Rio de Janeiro - RJ',
      now() + interval '30 days', now() + interval '30 days 5 hours',
      'Sem reembolso após 7 dias antes do evento.', 4, true
    ) RETURNING id INTO evt_id;
    INSERT INTO public.ticket_lots (event_id, name, price_cents, total_quantity, opens_at, closes_at, sort_order) VALUES
      (evt_id, 'Individual', 19900, 80,  now() - interval '2 days', now() + interval '28 days', 1),
      (evt_id, 'Mesa (4)',   69900, 20,  now() - interval '2 days', now() + interval '28 days', 2);
  END IF;

  -- Evento 3
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE title = 'Workshop de Vendas Consultivas') THEN
    INSERT INTO public.events (title, organizer, description, location_name, address, starts_at, ends_at, cancellation_policy, max_tickets_per_user, is_published)
    VALUES (
      'Workshop de Vendas Consultivas',
      'Fluxo Consultoria',
      'Workshop intensivo de um dia sobre técnicas de vendas consultivas B2B para consultorias juniores.',
      'PUC-Rio — Auditório RDC',
      'R. Marquês de São Vicente, 225 - Gávea, Rio de Janeiro - RJ',
      now() + interval '15 days', now() + interval '15 days 8 hours',
      'Reembolso total até 48h antes do evento.', 3, true
    ) RETURNING id INTO evt_id;
    INSERT INTO public.ticket_lots (event_id, name, price_cents, total_quantity, opens_at, closes_at, sort_order) VALUES
      (evt_id, 'Estudante EJ',   4900,  60, now() - interval '10 days', now() + interval '14 days', 1),
      (evt_id, 'Profissional',  12900,  40, now() - interval '10 days', now() + interval '14 days', 2);
  END IF;

  -- Evento 4
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE title = 'Hackathon EJ Tech 2026') THEN
    INSERT INTO public.events (title, organizer, description, location_name, address, starts_at, ends_at, cancellation_policy, max_tickets_per_user, is_published)
    VALUES (
      'Hackathon EJ Tech 2026',
      'EJFGV',
      'Maratona de 36 horas para EJs de tecnologia desenvolverem soluções para desafios reais de patrocinadores.',
      'FGV EAESP — São Paulo',
      'R. Itapeva, 474 - Bela Vista, São Paulo - SP',
      now() + interval '45 days', now() + interval '46 days 12 hours',
      'Inscrição não reembolsável. Substituição de participante permitida até 5 dias antes.', 5, true
    ) RETURNING id INTO evt_id;
    INSERT INTO public.ticket_lots (event_id, name, price_cents, total_quantity, opens_at, closes_at, sort_order) VALUES
      (evt_id, 'Inscrição Individual', 7900,  120, now() - interval '3 days', now() + interval '40 days', 1),
      (evt_id, 'Equipe (4)',          27900,   30, now() - interval '3 days', now() + interval '40 days', 2);
  END IF;
END $$;

-- Safety: keep token columns non-NULL (some envs reject NULL on auth.users on update)
UPDATE auth.users SET
  confirmation_token = COALESCE(confirmation_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  recovery_token = COALESCE(recovery_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, '');
