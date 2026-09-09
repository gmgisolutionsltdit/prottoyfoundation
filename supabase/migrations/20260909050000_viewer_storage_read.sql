-- Viewers couldn't see attachments at all.
--
-- 20260909010000_viewer_read_policies.sql gave the viewer role SELECT on the
-- 13 business tables, but storage.objects was missed. So a viewer could read
-- a transaction row (including its attachment_url) while every signed-URL
-- request for the file itself was denied by the admin-only storage policy
-- from 20260810005113_storage_attachments.sql — the row rendered, the image
-- never arrived, and the UI sat on a loading placeholder indefinitely.
--
-- Read-only, and scoped to the same bucket as the admin policies: viewers get
-- SELECT and nothing else, so upload/update/delete stay admin-only.
DROP POLICY IF EXISTS "Viewers read transaction attachments" ON storage.objects;

CREATE POLICY "Viewers read transaction attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'transaction-attachments'
    AND private.has_role(auth.uid(), 'viewer'::public.app_role)
  );
