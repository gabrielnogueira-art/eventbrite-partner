
-- payment-proofs: owner is order.user_id; we store as <user_id>/<order_id>-<ts>.<ext>
DROP POLICY IF EXISTS proofs_user_insert ON storage.objects;
CREATE POLICY proofs_user_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS proofs_user_read ON storage.objects;
CREATE POLICY proofs_user_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin'::app_role)));
DROP POLICY IF EXISTS proofs_user_update ON storage.objects;
CREATE POLICY proofs_user_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- pix-assets: read by any authenticated; write by admin
DROP POLICY IF EXISTS pix_read ON storage.objects;
CREATE POLICY pix_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pix-assets');
DROP POLICY IF EXISTS pix_admin_write ON storage.objects;
CREATE POLICY pix_admin_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pix-assets' AND public.has_role(auth.uid(),'admin'::app_role));
DROP POLICY IF EXISTS pix_admin_update ON storage.objects;
CREATE POLICY pix_admin_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pix-assets' AND public.has_role(auth.uid(),'admin'::app_role));
DROP POLICY IF EXISTS pix_admin_delete ON storage.objects;
CREATE POLICY pix_admin_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pix-assets' AND public.has_role(auth.uid(),'admin'::app_role));
