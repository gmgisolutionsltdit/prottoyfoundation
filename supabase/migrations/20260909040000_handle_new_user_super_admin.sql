-- Lets a super admin be created directly from the Users page, instead of
-- creating an admin and then promoting them.
--
-- In this app super_admin is additive on top of admin: every write policy
-- checks has_role(uid,'admin') while only the Users page checks
-- is_super_admin(uid), so a super_admin row on its own would pass the Users
-- page but fail every business-table write. A requested super admin therefore
-- gets BOTH roles — matching what the first-account bootstrap below already
-- does.
--
-- 'viewer' and the default 'admin' path are unchanged, as is the bootstrap.
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_name text := NULLIF(NEW.raw_user_meta_data->>'full_name', '');
  v_requested text := NEW.raw_user_meta_data->>'role';
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, v_name)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.admin_profiles (user_id, email, full_name, is_active)
  VALUES (NEW.id, NEW.email, v_name, true)
  ON CONFLICT (user_id) DO NOTHING;

  IF v_requested = 'viewer' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'viewer'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    IF v_requested = 'super_admin' THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'super_admin'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;

  -- First account ever also becomes the super admin (unchanged).
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
