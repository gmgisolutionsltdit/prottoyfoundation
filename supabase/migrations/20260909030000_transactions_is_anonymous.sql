-- Lets an income entry be explicitly marked as an anonymous donation, rather
-- than inferring it from a missing donor name (which can't tell "the donor
-- asked not to be named" apart from "nobody recorded the name").
--
-- Purely additive: NOT NULL with a false default, so every existing row keeps
-- its current meaning and any INSERT that names its columns is unaffected.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;
