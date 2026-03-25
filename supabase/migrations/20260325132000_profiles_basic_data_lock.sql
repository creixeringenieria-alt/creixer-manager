-- Bloqueo de edición de datos básicos:
-- una vez guardados, solo super_admin puede editar.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS basic_data_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS basic_data_locked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_basic_data_locked ON public.profiles(basic_data_locked);
