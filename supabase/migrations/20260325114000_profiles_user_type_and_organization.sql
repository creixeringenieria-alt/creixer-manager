-- Diferenciacion de usuarios internos Creixer vs usuarios externos de inmobiliaria.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_type text NOT NULL DEFAULT 'colaborador_creixer',
  ADD COLUMN IF NOT EXISTS organization_name text;

UPDATE public.profiles
SET user_type = CASE
  WHEN client_id IS NOT NULL THEN 'usuario_inmobiliaria'
  ELSE 'colaborador_creixer'
END
WHERE user_type IS NULL
   OR user_type NOT IN ('colaborador_creixer', 'usuario_inmobiliaria');

UPDATE public.profiles
SET organization_name = 'Creixer Ingeniería S.A.S.'
WHERE user_type = 'colaborador_creixer'
  AND (organization_name IS NULL OR btrim(organization_name) = '');

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_user_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_type_check
  CHECK (user_type IN ('colaborador_creixer', 'usuario_inmobiliaria'));

CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles(user_type);
