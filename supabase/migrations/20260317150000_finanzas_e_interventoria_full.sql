-- Integración financiera obligatoria + expansión de interventoría

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'financial_case_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.financial_case_type AS ENUM ('mantenimiento', 'inmobiliaria', 'consultoria', 'interventoria');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'financial_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.financial_status AS ENUM (
      'sin_cotizacion',
      'cotizado',
      'aprobado',
      'anticipo_pendiente',
      'en_ejecucion',
      'facturacion_pendiente',
      'facturado_parcial',
      'facturado_total',
      'cartera_pendiente',
      'cerrado'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'advance_request_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.advance_request_status AS ENUM ('solicitado', 'aprobado', 'recibido', 'rechazado');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'invoice_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.invoice_status AS ENUM ('borrador', 'emitida', 'vencida', 'pagada_parcial', 'pagada_total', 'anulada');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'interventoria_contract_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.interventoria_contract_status AS ENUM ('planeado', 'en_ejecucion', 'suspendido', 'cerrado', 'cancelado');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'interventoria_quality_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.interventoria_quality_status AS ENUM ('conforme', 'no_conforme', 'en_seguimiento', 'cerrado');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'interventoria_requirement_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.interventoria_requirement_status AS ENUM ('abierto', 'en_proceso', 'respondido', 'cerrado', 'vencido');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'interventoria_acta_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.interventoria_acta_type AS ENUM ('inicio', 'comite', 'visita', 'suspension', 'reinicio', 'cierre', 'parcial');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'interventoria_sst_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.interventoria_sst_status AS ENUM ('abierta', 'en_gestion', 'cerrada');
  END IF;
END
$$;

ALTER TYPE public.project_document_type ADD VALUE IF NOT EXISTS 'contrato';
ALTER TYPE public.project_document_type ADD VALUE IF NOT EXISTS 'pliegos';
ALTER TYPE public.project_document_type ADD VALUE IF NOT EXISTS 'cronograma_contractual';
ALTER TYPE public.project_document_type ADD VALUE IF NOT EXISTS 'presupuesto';
ALTER TYPE public.project_document_type ADD VALUE IF NOT EXISTS 'especificaciones';
ALTER TYPE public.project_document_type ADD VALUE IF NOT EXISTS 'polizas';
ALTER TYPE public.project_document_type ADD VALUE IF NOT EXISTS 'licencias';

CREATE TABLE IF NOT EXISTS public.financial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_type public.financial_case_type NOT NULL,
  requerimiento_id uuid REFERENCES public.requerimientos(id) ON DELETE CASCADE,
  technical_project_id uuid REFERENCES public.technical_projects(id) ON DELETE CASCADE,
  valor_cotizado numeric(14,2) NOT NULL DEFAULT 0,
  valor_aprobado numeric(14,2) NOT NULL DEFAULT 0,
  requiere_anticipo boolean NOT NULL DEFAULT false,
  porcentaje_anticipo numeric(6,2) NOT NULL DEFAULT 0,
  valor_anticipo_solicitado numeric(14,2) NOT NULL DEFAULT 0,
  valor_anticipo_recibido numeric(14,2) NOT NULL DEFAULT 0,
  fecha_solicitud_anticipo date,
  fecha_recepcion_anticipo date,
  valor_facturado numeric(14,2) NOT NULL DEFAULT 0,
  valor_cobrado numeric(14,2) NOT NULL DEFAULT 0,
  saldo_por_facturar numeric(14,2) NOT NULL DEFAULT 0,
  saldo_por_cobrar numeric(14,2) NOT NULL DEFAULT 0,
  costo_total_asociado numeric(14,2) NOT NULL DEFAULT 0,
  utilidad_estimada numeric(14,2) NOT NULL DEFAULT 0,
  utilidad_real numeric(14,2) NOT NULL DEFAULT 0,
  estado_financiero public.financial_status NOT NULL DEFAULT 'sin_cotizacion',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_records_case_fk_chk CHECK (
    (requerimiento_id IS NOT NULL AND technical_project_id IS NULL)
    OR (requerimiento_id IS NULL AND technical_project_id IS NOT NULL)
  ),
  CONSTRAINT financial_records_non_negative_chk CHECK (
    valor_cotizado >= 0 AND valor_aprobado >= 0 AND valor_anticipo_solicitado >= 0 AND valor_anticipo_recibido >= 0
    AND valor_facturado >= 0 AND valor_cobrado >= 0 AND saldo_por_facturar >= 0 AND saldo_por_cobrar >= 0
    AND costo_total_asociado >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_records_requerimiento_unique ON public.financial_records(requerimiento_id) WHERE requerimiento_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_records_project_unique ON public.financial_records(technical_project_id) WHERE technical_project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financial_records_status ON public.financial_records(estado_financiero);
CREATE INDEX IF NOT EXISTS idx_financial_records_case_type ON public.financial_records(case_type);

CREATE TABLE IF NOT EXISTS public.advance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_record_id uuid NOT NULL REFERENCES public.financial_records(id) ON DELETE CASCADE,
  requested_at date NOT NULL DEFAULT current_date,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  percentage numeric(6,2) NOT NULL DEFAULT 0,
  amount_requested numeric(14,2) NOT NULL DEFAULT 0,
  amount_received numeric(14,2) NOT NULL DEFAULT 0,
  received_at date,
  status public.advance_request_status NOT NULL DEFAULT 'solicitado',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT advance_requests_amount_chk CHECK (percentage >= 0 AND percentage <= 100 AND amount_requested >= 0 AND amount_received >= 0)
);

CREATE INDEX IF NOT EXISTS idx_advance_requests_financial_record ON public.advance_requests(financial_record_id);
CREATE INDEX IF NOT EXISTS idx_advance_requests_status ON public.advance_requests(status);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_record_id uuid NOT NULL REFERENCES public.financial_records(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  dian_number text,
  issued_at date NOT NULL DEFAULT current_date,
  due_at date,
  amount_subtotal numeric(14,2) NOT NULL DEFAULT 0,
  amount_tax numeric(14,2) NOT NULL DEFAULT 0,
  amount_total numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  amount_pending numeric(14,2) NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'emitida',
  pdf_url text,
  xml_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_amount_chk CHECK (amount_subtotal >= 0 AND amount_tax >= 0 AND amount_total >= 0 AND amount_paid >= 0 AND amount_pending >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_unique ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_financial_record ON public.invoices(financial_record_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_at ON public.invoices(due_at);

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  paid_at date NOT NULL DEFAULT current_date,
  amount numeric(14,2) NOT NULL,
  received_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  payment_method text,
  reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_payments_amount_chk CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON public.invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_paid_at ON public.invoice_payments(paid_at);

CREATE TABLE IF NOT EXISTS public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  note_number text NOT NULL,
  issued_at date NOT NULL DEFAULT current_date,
  amount numeric(14,2) NOT NULL,
  reason text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_notes_amount_chk CHECK (amount > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_notes_number_unique ON public.credit_notes(note_number);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON public.credit_notes(invoice_id);

CREATE TABLE IF NOT EXISTS public.requerimiento_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requerimiento_id uuid NOT NULL REFERENCES public.requerimientos(id) ON DELETE CASCADE,
  document_type text NOT NULL DEFAULT 'archivo_tecnico',
  name text NOT NULL,
  original_filename text NOT NULL,
  storage_path text NOT NULL,
  file_url text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requerimiento_documents_requerimiento ON public.requerimiento_documents(requerimiento_id);
CREATE INDEX IF NOT EXISTS idx_requerimiento_documents_type ON public.requerimiento_documents(document_type);

CREATE TABLE IF NOT EXISTS public.interventoria_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.technical_projects(id) ON DELETE CASCADE,
  contractor_name text NOT NULL,
  contract_object text NOT NULL,
  location text,
  contract_term_days integer,
  contract_start_date date,
  contract_end_date date,
  contract_value numeric(14,2) NOT NULL DEFAULT 0,
  interventoria_responsible_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.interventoria_contract_status NOT NULL DEFAULT 'planeado',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interventoria_contract_value_chk CHECK (contract_value >= 0),
  CONSTRAINT interventoria_contract_term_chk CHECK (contract_term_days IS NULL OR contract_term_days >= 0)
);

CREATE TABLE IF NOT EXISTS public.interventoria_site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.technical_projects(id) ON DELETE CASCADE,
  visit_date date NOT NULL DEFAULT current_date,
  responsible_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  observed_activities text NOT NULL,
  progress_percent numeric(5,2) NOT NULL DEFAULT 0,
  observations text,
  commitments text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interventoria_site_visits_progress_chk CHECK (progress_percent >= 0 AND progress_percent <= 100)
);

CREATE TABLE IF NOT EXISTS public.interventoria_visit_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.interventoria_site_visits(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.interventoria_physical_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.technical_projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.technical_project_tasks(id) ON DELETE SET NULL,
  activity_name text NOT NULL,
  unit text NOT NULL,
  quantity_programmed numeric(14,4) NOT NULL DEFAULT 0,
  quantity_executed numeric(14,4) NOT NULL DEFAULT 0,
  progress_percent numeric(5,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interventoria_physical_progress_chk CHECK (
    quantity_programmed >= 0 AND quantity_executed >= 0 AND progress_percent >= 0 AND progress_percent <= 100
  )
);

CREATE TABLE IF NOT EXISTS public.interventoria_financial_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.technical_projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.technical_project_tasks(id) ON DELETE SET NULL,
  activity_name text NOT NULL,
  value_programmed numeric(14,2) NOT NULL DEFAULT 0,
  value_executed numeric(14,2) NOT NULL DEFAULT 0,
  value_pending numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interventoria_financial_progress_chk CHECK (value_programmed >= 0 AND value_executed >= 0 AND value_pending >= 0)
);

CREATE TABLE IF NOT EXISTS public.interventoria_quality_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.technical_projects(id) ON DELETE CASCADE,
  inspection_type text NOT NULL,
  test_reference text,
  status public.interventoria_quality_status NOT NULL DEFAULT 'conforme',
  observations text,
  corrective_actions text,
  close_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.interventoria_sst_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.technical_projects(id) ON DELETE CASCADE,
  observation text NOT NULL,
  non_compliance text,
  corrective_action text,
  status public.interventoria_sst_status NOT NULL DEFAULT 'abierta',
  close_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.interventoria_actas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.technical_projects(id) ON DELETE CASCADE,
  acta_type public.interventoria_acta_type NOT NULL,
  title text NOT NULL,
  meeting_date date NOT NULL DEFAULT current_date,
  summary text,
  commitments text,
  file_url text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.interventoria_contractor_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.technical_projects(id) ON DELETE CASCADE,
  description text NOT NULL,
  request_date date NOT NULL DEFAULT current_date,
  responsible_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date date,
  status public.interventoria_requirement_status NOT NULL DEFAULT 'abierto',
  support_url text,
  close_notes text,
  close_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interventoria_contracts_project ON public.interventoria_contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_interventoria_contracts_status ON public.interventoria_contracts(status);
CREATE INDEX IF NOT EXISTS idx_interventoria_site_visits_project ON public.interventoria_site_visits(project_id);
CREATE INDEX IF NOT EXISTS idx_interventoria_site_visits_date ON public.interventoria_site_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_interventoria_visit_photos_visit ON public.interventoria_visit_photos(visit_id);
CREATE INDEX IF NOT EXISTS idx_interventoria_physical_progress_project ON public.interventoria_physical_progress(project_id);
CREATE INDEX IF NOT EXISTS idx_interventoria_financial_progress_project ON public.interventoria_financial_progress(project_id);
CREATE INDEX IF NOT EXISTS idx_interventoria_quality_records_project ON public.interventoria_quality_records(project_id);
CREATE INDEX IF NOT EXISTS idx_interventoria_sst_records_project ON public.interventoria_sst_records(project_id);
CREATE INDEX IF NOT EXISTS idx_interventoria_actas_project ON public.interventoria_actas(project_id);
CREATE INDEX IF NOT EXISTS idx_interventoria_contractor_requirements_project ON public.interventoria_contractor_requirements(project_id);
CREATE INDEX IF NOT EXISTS idx_interventoria_contractor_requirements_status ON public.interventoria_contractor_requirements(status);
CREATE INDEX IF NOT EXISTS idx_interventoria_contractor_requirements_due_date ON public.interventoria_contractor_requirements(due_date);

DROP TRIGGER IF EXISTS set_financial_records_updated_at ON public.financial_records;
CREATE TRIGGER set_financial_records_updated_at
BEFORE UPDATE ON public.financial_records
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_advance_requests_updated_at ON public.advance_requests;
CREATE TRIGGER set_advance_requests_updated_at
BEFORE UPDATE ON public.advance_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_invoices_updated_at ON public.invoices;
CREATE TRIGGER set_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_interventoria_contracts_updated_at ON public.interventoria_contracts;
CREATE TRIGGER set_interventoria_contracts_updated_at
BEFORE UPDATE ON public.interventoria_contracts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_interventoria_site_visits_updated_at ON public.interventoria_site_visits;
CREATE TRIGGER set_interventoria_site_visits_updated_at
BEFORE UPDATE ON public.interventoria_site_visits
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_interventoria_physical_progress_updated_at ON public.interventoria_physical_progress;
CREATE TRIGGER set_interventoria_physical_progress_updated_at
BEFORE UPDATE ON public.interventoria_physical_progress
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_interventoria_financial_progress_updated_at ON public.interventoria_financial_progress;
CREATE TRIGGER set_interventoria_financial_progress_updated_at
BEFORE UPDATE ON public.interventoria_financial_progress
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_interventoria_quality_records_updated_at ON public.interventoria_quality_records;
CREATE TRIGGER set_interventoria_quality_records_updated_at
BEFORE UPDATE ON public.interventoria_quality_records
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_interventoria_sst_records_updated_at ON public.interventoria_sst_records;
CREATE TRIGGER set_interventoria_sst_records_updated_at
BEFORE UPDATE ON public.interventoria_sst_records
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_interventoria_actas_updated_at ON public.interventoria_actas;
CREATE TRIGGER set_interventoria_actas_updated_at
BEFORE UPDATE ON public.interventoria_actas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_interventoria_contractor_requirements_updated_at ON public.interventoria_contractor_requirements;
CREATE TRIGGER set_interventoria_contractor_requirements_updated_at
BEFORE UPDATE ON public.interventoria_contractor_requirements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.sync_invoice_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  paid_total numeric(14,2);
BEGIN
  SELECT coalesce(sum(amount), 0) INTO paid_total
  FROM public.invoice_payments
  WHERE invoice_id = new.invoice_id;

  UPDATE public.invoices
  SET
    amount_paid = paid_total,
    amount_pending = greatest(amount_total - paid_total, 0),
    status = CASE
      WHEN paid_total >= amount_total THEN 'pagada_total'
      WHEN paid_total > 0 THEN 'pagada_parcial'
      WHEN due_at IS NOT NULL AND due_at < current_date THEN 'vencida'
      ELSE status
    END,
    updated_at = now()
  WHERE id = new.invoice_id;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_invoice_totals ON public.invoice_payments;
CREATE TRIGGER trg_sync_invoice_totals
AFTER INSERT OR UPDATE ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_totals();

CREATE OR REPLACE FUNCTION public.sync_financial_record_rollup(fin_record_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  inv_total numeric(14,2);
  inv_paid numeric(14,2);
  adv_requested numeric(14,2);
  adv_received numeric(14,2);
  approved numeric(14,2);
  cost_total numeric(14,2);
BEGIN
  SELECT coalesce(sum(amount_total),0), coalesce(sum(amount_paid),0)
  INTO inv_total, inv_paid
  FROM public.invoices
  WHERE financial_record_id = fin_record_id
    AND status <> 'anulada';

  SELECT coalesce(sum(amount_requested),0), coalesce(sum(amount_received),0)
  INTO adv_requested, adv_received
  FROM public.advance_requests
  WHERE financial_record_id = fin_record_id
    AND status <> 'rechazado';

  SELECT valor_aprobado, costo_total_asociado
  INTO approved, cost_total
  FROM public.financial_records
  WHERE id = fin_record_id;

  UPDATE public.financial_records
  SET
    valor_anticipo_solicitado = adv_requested,
    valor_anticipo_recibido = adv_received,
    valor_facturado = inv_total,
    valor_cobrado = inv_paid,
    saldo_por_facturar = greatest(approved - inv_total, 0),
    saldo_por_cobrar = greatest(inv_total - inv_paid, 0),
    utilidad_estimada = approved - cost_total,
    utilidad_real = inv_paid - cost_total,
    estado_financiero = CASE
      WHEN inv_total = 0 AND approved = 0 THEN 'sin_cotizacion'
      WHEN inv_total = 0 AND approved > 0 THEN 'facturacion_pendiente'
      WHEN inv_total > 0 AND inv_paid = 0 THEN 'facturado_parcial'
      WHEN inv_total > inv_paid THEN 'cartera_pendiente'
      WHEN inv_total > 0 AND inv_total = inv_paid THEN 'cerrado'
      ELSE estado_financiero
    END,
    updated_at = now()
  WHERE id = fin_record_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_sync_financial_from_invoice()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.sync_financial_record_rollup(coalesce(new.financial_record_id, old.financial_record_id));
  RETURN coalesce(new, old);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_financial_from_invoice ON public.invoices;
CREATE TRIGGER trg_sync_financial_from_invoice
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.trigger_sync_financial_from_invoice();

CREATE OR REPLACE FUNCTION public.trigger_sync_financial_from_advance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.sync_financial_record_rollup(coalesce(new.financial_record_id, old.financial_record_id));
  RETURN coalesce(new, old);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_financial_from_advance ON public.advance_requests;
CREATE TRIGGER trg_sync_financial_from_advance
AFTER INSERT OR UPDATE OR DELETE ON public.advance_requests
FOR EACH ROW EXECUTE FUNCTION public.trigger_sync_financial_from_advance();

CREATE OR REPLACE FUNCTION public.create_financial_record_for_requerimiento()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.financial_records (case_type, requerimiento_id, estado_financiero)
  VALUES ('inmobiliaria', new.id, 'sin_cotizacion')
  ON CONFLICT (requerimiento_id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_financial_record_for_requerimiento ON public.requerimientos;
CREATE TRIGGER trg_create_financial_record_for_requerimiento
AFTER INSERT ON public.requerimientos
FOR EACH ROW EXECUTE FUNCTION public.create_financial_record_for_requerimiento();

CREATE OR REPLACE FUNCTION public.create_financial_record_for_project()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  case_kind public.financial_case_type;
BEGIN
  case_kind := CASE
    WHEN new.type = 'interventoria' THEN 'interventoria'
    WHEN new.type = 'consultoria' THEN 'consultoria'
    ELSE 'mantenimiento'
  END;

  INSERT INTO public.financial_records (case_type, technical_project_id, estado_financiero)
  VALUES (case_kind, new.id, 'sin_cotizacion')
  ON CONFLICT (technical_project_id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_financial_record_for_project ON public.technical_projects;
CREATE TRIGGER trg_create_financial_record_for_project
AFTER INSERT ON public.technical_projects
FOR EACH ROW EXECUTE FUNCTION public.create_financial_record_for_project();

ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requerimiento_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventoria_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventoria_site_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventoria_visit_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventoria_physical_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventoria_financial_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventoria_quality_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventoria_sst_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventoria_actas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventoria_contractor_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_asistentes_manage_financial_records"
ON public.financial_records FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_contabilidad_manage_advances"
ON public.advance_requests FOR ALL
USING (public.current_user_role() IN ('administrador', 'contabilidad', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'contabilidad', 'asistente'));

CREATE POLICY "admins_contabilidad_manage_invoices"
ON public.invoices FOR ALL
USING (public.current_user_role() IN ('administrador', 'contabilidad'))
WITH CHECK (public.current_user_role() IN ('administrador', 'contabilidad'));

CREATE POLICY "admins_contabilidad_manage_invoice_payments"
ON public.invoice_payments FOR ALL
USING (public.current_user_role() IN ('administrador', 'contabilidad'))
WITH CHECK (public.current_user_role() IN ('administrador', 'contabilidad'));

CREATE POLICY "admins_contabilidad_manage_credit_notes"
ON public.credit_notes FOR ALL
USING (public.current_user_role() IN ('administrador', 'contabilidad'))
WITH CHECK (public.current_user_role() IN ('administrador', 'contabilidad'));

CREATE POLICY "admins_asistentes_manage_requerimiento_documents"
ON public.requerimiento_documents FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_interventoria_contracts"
ON public.interventoria_contracts FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_interventoria_site_visits"
ON public.interventoria_site_visits FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_interventoria_visit_photos"
ON public.interventoria_visit_photos FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_interventoria_physical_progress"
ON public.interventoria_physical_progress FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_interventoria_financial_progress"
ON public.interventoria_financial_progress FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_interventoria_quality_records"
ON public.interventoria_quality_records FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_interventoria_sst_records"
ON public.interventoria_sst_records FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_interventoria_actas"
ON public.interventoria_actas FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_interventoria_contractor_requirements"
ON public.interventoria_contractor_requirements FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));
