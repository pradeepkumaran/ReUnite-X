-- Restrict raw case/person/photo access to the reporter and operational responders.
-- Public discovery must go through the API sanitizer rather than table or Storage access.

DROP POLICY IF EXISTS "Users can view own reported cases" ON cases;
CREATE POLICY "Reporters and responders can view cases"
    ON cases FOR SELECT
    USING (
        reporter_id = auth.uid()
        OR current_user_role() IN ('volunteer', 'authority', 'admin')
    );

DROP POLICY IF EXISTS "View persons" ON persons;
CREATE POLICY "Reporters and responders can view person details"
    ON persons FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM cases c
            WHERE c.id = persons.case_id
              AND (
                  c.reporter_id = auth.uid()
                  OR current_user_role() IN ('volunteer', 'authority', 'admin')
              )
        )
    );

DROP POLICY IF EXISTS "View photos" ON photos;
CREATE POLICY "Reporters and responders can view photo metadata"
    ON photos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM cases c
            WHERE c.id = photos.case_id
              AND (
                  c.reporter_id = auth.uid()
                  OR current_user_role() IN ('volunteer', 'authority', 'admin')
              )
        )
    );

DROP POLICY IF EXISTS "Allow authenticated uploads to case-photos" ON storage.objects;
CREATE POLICY "Reporters and responders can upload case photos"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'case-photos'
        AND EXISTS (
            SELECT 1 FROM cases c
            WHERE c.id::text = (storage.foldername(name))[2]
              AND (
                  c.reporter_id = auth.uid()
                  OR current_user_role() IN ('volunteer', 'authority', 'admin')
              )
        )
    );

DROP POLICY IF EXISTS "Allow authorized reads from case-photos" ON storage.objects;
CREATE POLICY "Reporters and responders can read case photos"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'case-photos'
        AND EXISTS (
            SELECT 1 FROM cases c
            WHERE c.id::text = (storage.foldername(name))[2]
              AND (
                  c.reporter_id = auth.uid()
                  OR current_user_role() IN ('volunteer', 'authority', 'admin')
              )
        )
    );

DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "Authorities can create notifications"
    ON notifications FOR INSERT
    WITH CHECK (current_user_role() IN ('authority', 'admin'));
