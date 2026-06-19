
CREATE POLICY "event covers read auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'event-covers');
CREATE POLICY "event covers admin write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'event-covers' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "event covers admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'event-covers' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "event covers admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'event-covers' AND public.has_role(auth.uid(), 'admin'));
