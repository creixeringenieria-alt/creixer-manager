-- Estructura de personal: datos basicos en profiles + perfil complementario laboral/seguridad social.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_document_unique
  ON public.profiles (document_type, document_number)
  WHERE document_type IS NOT NULL AND document_number IS NOT NULL;

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
  ON public.profile_complementary_data (ciudad_residencia);

DROP TRIGGER IF EXISTS set_profile_complementary_data_updated_at ON public.profile_complementary_data;
CREATE TRIGGER set_profile_complementary_data_updated_at
BEFORE UPDATE ON public.profile_complementary_data
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profile_complementary_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_complementary_self_select ON public.profile_complementary_data;
CREATE POLICY profile_complementary_self_select
ON public.profile_complementary_data
FOR SELECT
USING (id = auth.uid());

DROP POLICY IF EXISTS profile_complementary_self_insert ON public.profile_complementary_data;
CREATE POLICY profile_complementary_self_insert
ON public.profile_complementary_data
FOR INSERT
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profile_complementary_self_update ON public.profile_complementary_data;
CREATE POLICY profile_complementary_self_update
ON public.profile_complementary_data
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profile_complementary_admin_manage ON public.profile_complementary_data;
CREATE POLICY profile_complementary_admin_manage
ON public.profile_complementary_data
FOR ALL
USING (public.current_user_role() IN ('super_admin', 'administrador'))
WITH CHECK (public.current_user_role() IN ('super_admin', 'administrador'));

