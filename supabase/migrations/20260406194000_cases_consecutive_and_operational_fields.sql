-- Flujo completo de casos: consecutivo automático + campos operativos.

CREATE SEQUENCE IF NOT EXISTS public.cases_consecutive_seq START WITH 1 INCREMENT BY 1;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS case_number bigint,
  ADD COLUMN IF NOT EXISTS case_code text,
  ADD COLUMN IF NOT EXISTS flow_type text,
  ADD COLUMN IF NOT EXISTS service_area text,
  ADD COLUMN IF NOT EXISTS internal_client_code text,
  ADD COLUMN IF NOT EXISTS start_with_visit boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS current_stage text,
  ADD COLUMN IF NOT EXISTS estimated_delivery_date date,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.cases
  ALTER COLUMN case_number SET DEFAULT nextval('public.cases_consecutive_seq');

UPDATE public.cases
SET case_number = nextval('public.cases_consecutive_seq')
WHERE case_number IS NULL;

UPDATE public.cases
SET case_code = 'CAS-' || LPAD(case_number::text, 6, '0')
WHERE case_code IS NULL OR btrim(case_code) = '';

ALTER TABLE public.cases
  ALTER COLUMN case_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cases_case_number_unique ON public.cases(case_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cases_case_code_unique ON public.cases(case_code);

ALTER TABLE public.cases
  DROP CONSTRAINT IF EXISTS cases_flow_type_chk;

ALTER TABLE public.cases
  ADD CONSTRAINT cases_flow_type_chk
  CHECK (
    flow_type IS NULL OR flow_type IN (
      'mantenimiento',
      'reparacion',
      'consultoria',
      'interventoria',
      'obra_conjunto_residencial'
    )
  );

ALTER TABLE public.cases
  DROP CONSTRAINT IF EXISTS cases_service_area_chk;

ALTER TABLE public.cases
  ADD CONSTRAINT cases_service_area_chk
  CHECK (
    service_area IS NULL OR service_area IN (
      'hidraulico',
      'electrico',
      'gasodomestico',
      'albanileria',
      'acabados',
      'mantenimiento_general'
    )
  );

ALTER TABLE public.cases
  DROP CONSTRAINT IF EXISTS cases_current_stage_chk;

ALTER TABLE public.cases
  ADD CONSTRAINT cases_current_stage_chk
  CHECK (
    current_stage IS NULL OR current_stage IN (
      'en_visita',
      'visitado',
      'pendiente_aprobacion',
      'aprobado',
      'en_reparacion',
      'finalizado',
      'cancelado'
    )
  );

CREATE INDEX IF NOT EXISTS idx_cases_flow_type ON public.cases(flow_type);
CREATE INDEX IF NOT EXISTS idx_cases_service_area ON public.cases(service_area);
CREATE INDEX IF NOT EXISTS idx_cases_current_stage ON public.cases(current_stage);
CREATE INDEX IF NOT EXISTS idx_cases_internal_client_code ON public.cases(internal_client_code);

CREATE OR REPLACE FUNCTION public.assign_case_consecutive()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.case_number IS NULL THEN
    NEW.case_number := nextval('public.cases_consecutive_seq');
  END IF;

  IF NEW.case_code IS NULL OR btrim(NEW.case_code) = '' THEN
    NEW.case_code := 'CAS-' || LPAD(NEW.case_number::text, 6, '0');
  END IF;

  IF NEW.status IS NULL OR btrim(NEW.status) = '' THEN
    NEW.status := 'en_visita';
  END IF;

  IF NEW.current_stage IS NULL OR btrim(NEW.current_stage) = '' THEN
    NEW.current_stage := 'en_visita';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_case_consecutive ON public.cases;
CREATE TRIGGER trg_assign_case_consecutive
BEFORE INSERT ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.assign_case_consecutive();

NOTIFY pgrst, 'reload schema';
