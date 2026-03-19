-- Extensión de proyectos técnicos: documentos iniciales y agenda operativa de tareas

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'project_document_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.project_document_type AS ENUM (
      'convocatoria',
      'terminos_referencia',
      'anexos',
      'planos',
      'documento_cliente',
      'archivo_tecnico',
      'otro'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'technical_task_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.technical_task_type AS ENUM (
      'visita_tecnica',
      'levantamiento_cantidades',
      'informe_tecnico',
      'revision_documental',
      'envio_cotizacion',
      'seguimiento',
      'entrega_final',
      'otro'
    );
  END IF;
END
$$;

ALTER TABLE public.technical_projects
  ADD COLUMN IF NOT EXISTS linked_request_id uuid REFERENCES public.requerimientos(id) ON DELETE SET NULL;

ALTER TABLE public.technical_project_tasks
  ADD COLUMN IF NOT EXISTS task_type public.technical_task_type NOT NULL DEFAULT 'otro',
  ADD COLUMN IF NOT EXISTS scheduled_time time;

CREATE TABLE IF NOT EXISTS public.technical_project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.technical_projects(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_technical_projects_linked_request ON public.technical_projects(linked_request_id);
CREATE INDEX IF NOT EXISTS idx_technical_project_tasks_task_type ON public.technical_project_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_technical_project_tasks_scheduled_time ON public.technical_project_tasks(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_technical_project_documents_project ON public.technical_project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_technical_project_documents_type ON public.technical_project_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_technical_project_documents_uploaded_by ON public.technical_project_documents(uploaded_by);

ALTER TABLE public.technical_project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_asistentes_manage_technical_project_documents"
ON public.technical_project_documents
FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));
