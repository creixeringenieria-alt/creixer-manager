-- Módulo Proyectos Técnicos (mantenimiento, consultoría, interventoría)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'technical_project_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.technical_project_type AS ENUM ('mantenimiento', 'consultoria', 'interventoria');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'technical_project_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.technical_project_status AS ENUM ('planeado', 'en_ejecucion', 'en_pausa', 'completado', 'cancelado');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'technical_phase_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.technical_phase_status AS ENUM ('pendiente', 'en_progreso', 'completada', 'bloqueada');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'technical_task_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.technical_task_status AS ENUM ('pendiente', 'en_progreso', 'en_revision', 'completada', 'bloqueada', 'cancelada');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'technical_priority' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.technical_priority AS ENUM ('baja', 'media', 'alta', 'critica');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'technical_deliverable_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.technical_deliverable_status AS ENUM ('pendiente', 'en_preparacion', 'entregado', 'aprobado', 'rechazado');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'technical_quantity_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.technical_quantity_type AS ENUM ('sitio', 'modelo', 'calculada', 'diferencia');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'interventoria_record_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.interventoria_record_type AS ENUM ('acta', 'revision', 'no_conformidad', 'hito');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'project_alert_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.project_alert_type AS ENUM ('vencimiento_tarea', 'retraso_tarea', 'entregable_vencido', 'seguimiento_proximo', 'interventoria_vencida');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.technical_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  type public.technical_project_type NOT NULL,
  name text NOT NULL,
  description text,
  location text,
  status public.technical_project_status NOT NULL DEFAULT 'planeado',
  start_date date NOT NULL,
  planned_end_date date NOT NULL,
  actual_end_date date,
  priority public.technical_priority NOT NULL DEFAULT 'media',
  director_responsible_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  technical_lead_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT technical_projects_dates_chk CHECK (planned_end_date >= start_date),
  CONSTRAINT technical_projects_actual_end_chk CHECK (actual_end_date IS NULL OR actual_end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.technical_project_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.technical_projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  phase_order integer NOT NULL DEFAULT 1,
  status public.technical_phase_status NOT NULL DEFAULT 'pendiente',
  start_date date,
  planned_end_date date,
  actual_end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT technical_project_phases_order_chk CHECK (phase_order > 0),
  CONSTRAINT technical_project_phases_dates_chk CHECK (
    start_date IS NULL
    OR planned_end_date IS NULL
    OR planned_end_date >= start_date
  )
);

CREATE TABLE IF NOT EXISTS public.technical_project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.technical_projects(id) ON DELETE CASCADE,
  phase_id uuid REFERENCES public.technical_project_phases(id) ON DELETE SET NULL,
  parent_task_id uuid REFERENCES public.technical_project_tasks(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  responsible_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.technical_task_status NOT NULL DEFAULT 'pendiente',
  priority public.technical_priority NOT NULL DEFAULT 'media',
  progress_percent numeric(5,2) NOT NULL DEFAULT 0,
  start_date date,
  planned_end_date date,
  actual_end_date date,
  depends_on_task_id uuid REFERENCES public.technical_project_tasks(id) ON DELETE SET NULL,
  alert_enabled boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT technical_project_tasks_progress_chk CHECK (progress_percent >= 0 AND progress_percent <= 100),
  CONSTRAINT technical_project_tasks_dates_chk CHECK (
    start_date IS NULL
    OR planned_end_date IS NULL
    OR planned_end_date >= start_date
  ),
  CONSTRAINT technical_project_tasks_actual_end_chk CHECK (actual_end_date IS NULL OR start_date IS NULL OR actual_end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.technical_project_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.technical_projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.technical_project_tasks(id) ON DELETE SET NULL,
  deliverable_type text NOT NULL,
  name text NOT NULL,
  version text NOT NULL DEFAULT '1.0',
  status public.technical_deliverable_status NOT NULL DEFAULT 'pendiente',
  responsible_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  planned_delivery_date date,
  actual_delivery_date date,
  file_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.technical_project_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.technical_projects(id) ON DELETE CASCADE,
  followup_type text NOT NULL,
  date date NOT NULL DEFAULT current_date,
  responsible_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  summary text NOT NULL,
  commitments text,
  next_followup_date date,
  alert_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.technical_project_quantities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.technical_projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.technical_project_tasks(id) ON DELETE SET NULL,
  quantity_type public.technical_quantity_type NOT NULL,
  item_name text NOT NULL,
  value numeric(14,4) NOT NULL,
  unit text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.interventoria_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.technical_projects(id) ON DELETE CASCADE,
  record_type public.interventoria_record_type NOT NULL,
  title text NOT NULL,
  description text,
  status public.technical_task_status NOT NULL DEFAULT 'pendiente',
  responsible_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date date,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.technical_projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.technical_project_tasks(id) ON DELETE SET NULL,
  alert_type public.project_alert_type NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_technical_projects_client ON public.technical_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_technical_projects_type ON public.technical_projects(type);
CREATE INDEX IF NOT EXISTS idx_technical_projects_status ON public.technical_projects(status);
CREATE INDEX IF NOT EXISTS idx_technical_projects_director ON public.technical_projects(director_responsible_id);
CREATE INDEX IF NOT EXISTS idx_technical_projects_technical_lead ON public.technical_projects(technical_lead_id);
CREATE INDEX IF NOT EXISTS idx_technical_projects_dates ON public.technical_projects(start_date, planned_end_date);

CREATE INDEX IF NOT EXISTS idx_technical_project_phases_project ON public.technical_project_phases(project_id);
CREATE INDEX IF NOT EXISTS idx_technical_project_phases_order ON public.technical_project_phases(project_id, phase_order);

CREATE INDEX IF NOT EXISTS idx_technical_project_tasks_project ON public.technical_project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_technical_project_tasks_phase ON public.technical_project_tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_technical_project_tasks_responsible ON public.technical_project_tasks(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_technical_project_tasks_status ON public.technical_project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_technical_project_tasks_dates ON public.technical_project_tasks(start_date, planned_end_date);
CREATE INDEX IF NOT EXISTS idx_technical_project_tasks_depends ON public.technical_project_tasks(depends_on_task_id);

CREATE INDEX IF NOT EXISTS idx_technical_project_deliverables_project ON public.technical_project_deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_technical_project_deliverables_task ON public.technical_project_deliverables(task_id);
CREATE INDEX IF NOT EXISTS idx_technical_project_deliverables_status ON public.technical_project_deliverables(status);
CREATE INDEX IF NOT EXISTS idx_technical_project_deliverables_planned_date ON public.technical_project_deliverables(planned_delivery_date);

CREATE INDEX IF NOT EXISTS idx_technical_project_followups_project ON public.technical_project_followups(project_id);
CREATE INDEX IF NOT EXISTS idx_technical_project_followups_next_date ON public.technical_project_followups(next_followup_date);

CREATE INDEX IF NOT EXISTS idx_technical_project_quantities_project ON public.technical_project_quantities(project_id);
CREATE INDEX IF NOT EXISTS idx_technical_project_quantities_task ON public.technical_project_quantities(task_id);
CREATE INDEX IF NOT EXISTS idx_technical_project_quantities_type ON public.technical_project_quantities(quantity_type);

CREATE INDEX IF NOT EXISTS idx_interventoria_records_project ON public.interventoria_records(project_id);
CREATE INDEX IF NOT EXISTS idx_interventoria_records_type ON public.interventoria_records(record_type);
CREATE INDEX IF NOT EXISTS idx_interventoria_records_due_date ON public.interventoria_records(due_date);
CREATE INDEX IF NOT EXISTS idx_interventoria_records_status ON public.interventoria_records(status);

CREATE INDEX IF NOT EXISTS idx_project_alerts_project ON public.project_alerts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_alerts_task ON public.project_alerts(task_id);
CREATE INDEX IF NOT EXISTS idx_project_alerts_is_read ON public.project_alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_project_alerts_due_date ON public.project_alerts(due_date);

DROP TRIGGER IF EXISTS set_technical_projects_updated_at ON public.technical_projects;
CREATE TRIGGER set_technical_projects_updated_at
BEFORE UPDATE ON public.technical_projects
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_technical_project_phases_updated_at ON public.technical_project_phases;
CREATE TRIGGER set_technical_project_phases_updated_at
BEFORE UPDATE ON public.technical_project_phases
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_technical_project_tasks_updated_at ON public.technical_project_tasks;
CREATE TRIGGER set_technical_project_tasks_updated_at
BEFORE UPDATE ON public.technical_project_tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_technical_project_deliverables_updated_at ON public.technical_project_deliverables;
CREATE TRIGGER set_technical_project_deliverables_updated_at
BEFORE UPDATE ON public.technical_project_deliverables
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_technical_project_followups_updated_at ON public.technical_project_followups;
CREATE TRIGGER set_technical_project_followups_updated_at
BEFORE UPDATE ON public.technical_project_followups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_technical_project_quantities_updated_at ON public.technical_project_quantities;
CREATE TRIGGER set_technical_project_quantities_updated_at
BEFORE UPDATE ON public.technical_project_quantities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_interventoria_records_updated_at ON public.interventoria_records;
CREATE TRIGGER set_interventoria_records_updated_at
BEFORE UPDATE ON public.interventoria_records
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.create_project_alert_if_missing(
  p_project_id uuid,
  p_task_id uuid,
  p_alert_type public.project_alert_type,
  p_message text,
  p_due_date date
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.project_alerts pa
    WHERE pa.project_id = p_project_id
      AND pa.task_id IS NOT DISTINCT FROM p_task_id
      AND pa.alert_type = p_alert_type
      AND pa.message = p_message
      AND pa.is_read = false
  ) THEN
    INSERT INTO public.project_alerts (project_id, task_id, alert_type, message, due_date)
    VALUES (p_project_id, p_task_id, p_alert_type, p_message, p_due_date);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_alerts_from_task()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.alert_enabled = true AND new.planned_end_date IS NOT NULL THEN
    IF new.status <> 'completada' AND new.planned_end_date < current_date THEN
      PERFORM public.create_project_alert_if_missing(
        new.project_id,
        new.id,
        'vencimiento_tarea',
        'Tarea vencida: ' || new.name,
        new.planned_end_date
      );
    ELSIF new.status <> 'completada' AND new.planned_end_date <= current_date + 2 THEN
      PERFORM public.create_project_alert_if_missing(
        new.project_id,
        new.id,
        'retraso_tarea',
        'Tarea próxima a vencerse: ' || new.name,
        new.planned_end_date
      );
    END IF;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_alerts_from_task ON public.technical_project_tasks;
CREATE TRIGGER trg_sync_alerts_from_task
AFTER INSERT OR UPDATE OF status, planned_end_date, alert_enabled ON public.technical_project_tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_alerts_from_task();

CREATE OR REPLACE FUNCTION public.sync_alerts_from_deliverable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.planned_delivery_date IS NOT NULL AND new.status NOT IN ('entregado', 'aprobado') AND new.planned_delivery_date < current_date THEN
    PERFORM public.create_project_alert_if_missing(
      new.project_id,
      new.task_id,
      'entregable_vencido',
      'Entregable vencido: ' || new.name,
      new.planned_delivery_date
    );
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_alerts_from_deliverable ON public.technical_project_deliverables;
CREATE TRIGGER trg_sync_alerts_from_deliverable
AFTER INSERT OR UPDATE OF status, planned_delivery_date ON public.technical_project_deliverables
FOR EACH ROW EXECUTE FUNCTION public.sync_alerts_from_deliverable();

CREATE OR REPLACE FUNCTION public.sync_alerts_from_followup()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.alert_enabled = true AND new.next_followup_date IS NOT NULL AND new.next_followup_date <= current_date + 2 THEN
    PERFORM public.create_project_alert_if_missing(
      new.project_id,
      null,
      'seguimiento_proximo',
      'Seguimiento próximo: ' || coalesce(new.followup_type, 'general'),
      new.next_followup_date
    );
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_alerts_from_followup ON public.technical_project_followups;
CREATE TRIGGER trg_sync_alerts_from_followup
AFTER INSERT OR UPDATE OF next_followup_date, alert_enabled ON public.technical_project_followups
FOR EACH ROW EXECUTE FUNCTION public.sync_alerts_from_followup();

CREATE OR REPLACE FUNCTION public.sync_alerts_from_interventoria()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.due_date IS NOT NULL AND new.status <> 'completada' AND new.due_date < current_date THEN
    PERFORM public.create_project_alert_if_missing(
      new.project_id,
      null,
      'interventoria_vencida',
      'Registro interventoría vencido: ' || new.title,
      new.due_date
    );
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_alerts_from_interventoria ON public.interventoria_records;
CREATE TRIGGER trg_sync_alerts_from_interventoria
AFTER INSERT OR UPDATE OF status, due_date ON public.interventoria_records
FOR EACH ROW EXECUTE FUNCTION public.sync_alerts_from_interventoria();

ALTER TABLE public.technical_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_project_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_project_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_project_quantities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventoria_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_asistentes_manage_technical_projects"
ON public.technical_projects
FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_technical_project_phases"
ON public.technical_project_phases
FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_technical_project_tasks"
ON public.technical_project_tasks
FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "tecnicos_read_assigned_technical_project_tasks"
ON public.technical_project_tasks
FOR SELECT
USING (responsible_user_id = auth.uid());

CREATE POLICY "admins_asistentes_manage_technical_project_deliverables"
ON public.technical_project_deliverables
FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_technical_project_followups"
ON public.technical_project_followups
FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_technical_project_quantities"
ON public.technical_project_quantities
FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_interventoria_records"
ON public.interventoria_records
FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_project_alerts"
ON public.project_alerts
FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));
