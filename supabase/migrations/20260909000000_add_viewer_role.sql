-- Adds a third app_role value for a read-only "viewer" account. Split into its
-- own migration file (no other statement in this file references the new
-- value) because ALTER TYPE ... ADD VALUE cannot safely be used in the same
-- transaction as a statement that reads/compares the new label.
ALTER TYPE public.app_role ADD VALUE 'viewer';
