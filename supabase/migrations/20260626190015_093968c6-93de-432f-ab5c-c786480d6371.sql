
-- Restrict EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_payment(uuid, payment_method) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_reservation(uuid, integer) FROM PUBLIC, anon;
