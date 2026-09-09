-- Corrects one account's role: viewer@prottoy.local was requested as
-- 'viewer' via the Users page, but landed as 'admin' because the
-- create-admin edge function hadn't been redeployed yet with the role
-- field support added earlier the same day — the live function silently
-- dropped the unrecognized `role` key and fell back to its unconditional
-- admin creation. Scoped to exactly that one account; aborts (rolling
-- back the whole migration) if it doesn't find it, rather than silently
-- doing nothing.
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.admin_profiles WHERE email = 'viewer@prottoy.local';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No admin_profiles row found for viewer@prottoy.local — aborting, nothing changed.';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = v_user_id AND role = 'admin'::public.app_role;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'viewer'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
