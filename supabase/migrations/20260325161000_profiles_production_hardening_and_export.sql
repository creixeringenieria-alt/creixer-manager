-- Blindaje de producción para perfiles de usuarios internos/externos y exportación consolidada.
-- Esta migración es idempotente: puede ejecutarse varias veces sin romper datos existentes.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS user_type text NOT NULL DEFAULT 'colaborador_creixer',
  ADD COLUMN IF NOT EXISTS organization_name text,
  ADD COLUMN IF NOT EXISTS basic_data_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS basic_data_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Asegura FK con clients sin fallar si ya existe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_client_id_fkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Normaliza user_type y organización para evitar filas huérfanas.
UPDATE public.profiles
SET user_type = CASE WHEN client_id IS NOT NULL THEN 'usuario_inmobiliaria' ELSE 'colaborador_creixer' END
WHERE user_type IS NULL OR user_type NOT IN ('colaborador_creixer', 'usuario_inmobiliaria');

UPDATE public.profiles
SET organization_name = 'Creixer Ingeniería S.A.S.'
WHERE user_type = 'colaborador_creixer'
  AND (organization_name IS NULL OR btrim(organization_name) = '');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_type_check
  CHECK (user_type IN ('colaborador_creixer', 'usuario_inmobiliaria'));

CREATE INDEX IF NOT EXISTS idx_profiles_document_unique
  ON public.profiles (document_type, document_number)
  WHERE document_type IS NOT NULL AND document_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON public.profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_profiles_basic_data_locked ON public.profiles(basic_data_locked);

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.profile_complementary_data (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  fecha_nacimiento date,
  grupo_sanguineo_rh text,
  eps text,
  arl text,
  fondo_pension text,
  fondo_cesantias text,
  direccion_residencia text,
  ciudad_residencia text,
  contacto_emergencia_nombre text,
  contacto_emergencia_telefono text,
  parentesco_contacto_emergencia text,
  observaciones_medicas_relevantes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_complementary_city
  ON public.profile_complementary_data(ciudad_residencia);

DROP TRIGGER IF EXISTS set_profile_complementary_data_updated_at ON public.profile_complementary_data;
CREATE TRIGGER set_profile_complementary_data_updated_at
BEFORE UPDATE ON public.profile_complementary_data
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profile_complementary_data ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profile_complementary_data'
      AND policyname = 'profile_complementary_self_select'
  ) THEN
    EXECUTE 'CREATE POLICY profile_complementary_self_select ON public.profile_complementary_data FOR SELECT USING (id = auth.uid())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profile_complementary_data'
      AND policyname = 'profile_complementary_self_insert'
  ) THEN
    EXECUTE 'CREATE POLICY profile_complementary_self_insert ON public.profile_complementary_data FOR INSERT WITH CHECK (id = auth.uid())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profile_complementary_data'
      AND policyname = 'profile_complementary_self_update'
  ) THEN
    EXECUTE 'CREATE POLICY profile_complementary_self_update ON public.profile_complementary_data FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profile_complementary_data'
      AND policyname = 'profile_complementary_admin_manage'
  ) THEN
    EXECUTE 'CREATE POLICY profile_complementary_admin_manage ON public.profile_complementary_data FOR ALL USING (public.current_user_role() IN (''super_admin'', ''administrador'')) WITH CHECK (public.current_user_role() IN (''super_admin'', ''administrador''))';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.user_profiles_export AS
SELECT
  p.id,
  p.full_name,
  p.role,
  p.user_type,
  CASE
    WHEN p.user_type = 'usuario_inmobiliaria' THEN c.name
    ELSE COALESCE(p.organization_name, 'Creixer Ingeniería S.A.S.')
  END AS organization_or_client,
  p.client_id,
  c.name AS client_name,
  p.document_type,
  p.document_number,
  p.phone,
  p.is_active,
  p.basic_data_locked,
  p.created_at,
  p.updated_at,
  cd.fecha_nacimiento,
  cd.grupo_sanguineo_rh,
  cd.eps,
  cd.arl,
  cd.fondo_pension,
  cd.fondo_cesantias,
  cd.direccion_residencia,
  cd.ciudad_residencia,
  cd.contacto_emergencia_nombre,
  cd.contacto_emergencia_telefono,
  cd.parentesco_contacto_emergencia,
  cd.observaciones_medicas_relevantes
FROM public.profiles p
LEFT JOIN public.clients c ON c.id = p.client_id
LEFT JOIN public.profile_complementary_data cd ON cd.id = p.id;

COMMENT ON VIEW public.user_profiles_export IS
'Vista consolidada para exportar colaboradores internos y usuarios de inmobiliarias.';

NOTIFY pgrst, 'reload schema';
