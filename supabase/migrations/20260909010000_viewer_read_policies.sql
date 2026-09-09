-- Grants the new 'viewer' role read-only access to the same business tables
-- admins can write to (purely additive SELECT policies — every existing
-- admin/super_admin "FOR ALL" policy is untouched), and teaches new-user
-- provisioning how to create a viewer instead of an admin when asked to.

-- ---------------------------------------------------------------------------
-- Viewer SELECT policies (one per table already gated by
-- "Admins manage <table>" FOR ALL private.has_role(auth.uid(), 'admin')).
-- ---------------------------------------------------------------------------
CREATE POLICY "Viewers read member_types"              ON public.member_types              FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'viewer'::public.app_role));
CREATE POLICY "Viewers read funds"                     ON public.funds                     FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'viewer'::public.app_role));
CREATE POLICY "Viewers read members"                   ON public.members                   FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'viewer'::public.app_role));
CREATE POLICY "Viewers read member_member_types"       ON public.member_member_types       FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'viewer'::public.app_role));
CREATE POLICY "Viewers read member_fund_subscriptions" ON public.member_fund_subscriptions FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'viewer'::public.app_role));
CREATE POLICY "Viewers read transactions"              ON public.transactions              FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'viewer'::public.app_role));
CREATE POLICY "Viewers read expenses"                  ON public.expenses                  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'viewer'::public.app_role));
CREATE POLICY "Viewers read receipts"                  ON public.receipts                  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'viewer'::public.app_role));
CREATE POLICY "Viewers read blood_donors"              ON public.blood_donors              FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'viewer'::public.app_role));
CREATE POLICY "Viewers read meetings"                  ON public.meetings                  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'viewer'::public.app_role));
CREATE POLICY "Viewers read meeting_agenda_items"      ON public.meeting_agenda_items      FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'viewer'::public.app_role));
CREATE POLICY "Viewers read meeting_next_agenda_items" ON public.meeting_next_agenda_items FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'viewer'::public.app_role));
CREATE POLICY "Viewers read meeting_attendance"        ON public.meeting_attendance        FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'viewer'::public.app_role));

-- ---------------------------------------------------------------------------
-- New-user provisioning: assign 'viewer' when explicitly requested via
-- auth metadata (set by the create-admin edge function), 'admin' otherwise —
-- byte-identical to prior behavior for every existing signup path, since
-- none of them set a `role` metadata key.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_name text := NULLIF(NEW.raw_user_meta_data->>'full_name', '');
  v_role public.app_role := CASE
    WHEN NEW.raw_user_meta_data->>'role' = 'viewer' THEN 'viewer'::public.app_role
    ELSE 'admin'::public.app_role
  END;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, v_name)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.admin_profiles (user_id, email, full_name, is_active)
  VALUES (NEW.id, NEW.email, v_name, true)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- First account ever also becomes the super admin (unchanged condition —
  -- still keyed off whether any super_admin exists yet, not off v_role).
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'super_admin'::public.app_role
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
