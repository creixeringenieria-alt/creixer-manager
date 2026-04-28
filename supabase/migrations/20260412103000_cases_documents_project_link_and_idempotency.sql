-- Optimización flujo caso/proyecto:
-- 1) adjuntos en casos (fotos y archivos)
-- 2) vínculo case_id en proyectos técnicos
-- 3) token de idempotencia para evitar duplicados por doble envío

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS creation_token text;

ALTER TABLE public.technical_projects
  ADD COLUMN IF NOT EXISTS case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS creation_token text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cases_creation_token_unique
  ON public.cases(creation_token)
  WHERE creation_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_technical_projects_creation_token_unique
  ON public.technical_projects(creation_token)
  WHERE creation_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_technical_projects_case_id
  ON public.technical_projects(case_id);

CREATE TABLE IF NOT EXISTS public.case_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  document_type public.project_document_type NOT NULL DEFAULT 'otro',
  name text NOT NULL,
  original_filename text NOT NULL,
  storage_path text NOT NULL,
  file_url text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_documents_case
  ON public.case_documents(case_id);

CREATE INDEX IF NOT EXISTS idx_case_documents_type
  ON public.case_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_case_documents_uploaded_by
  ON public.case_documents(uploaded_by);

ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_documents'
      AND policyname = 'admins_asistentes_manage_case_documents'
  ) THEN
    CREATE POLICY "admins_asistentes_manage_case_documents"
    ON public.case_documents
    FOR ALL
    USING (public.current_user_role() IN ('super_admin', 'administrador', 'asistente'))
    WITH CHECK (public.current_user_role() IN ('super_admin', 'administrador', 'asistente'));
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
