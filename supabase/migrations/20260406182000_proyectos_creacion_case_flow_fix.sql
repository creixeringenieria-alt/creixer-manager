-- Corrige creación de proyectos/casos cuando faltan índices únicos para ON CONFLICT
-- y ajusta modelo para flujo operativo de casos.

ALTER TYPE public.technical_project_type ADD VALUE IF NOT EXISTS 'obra_conjunto_residencial';
ALTER TYPE public.technical_project_status ADD VALUE IF NOT EXISTS 'en_visita';

ALTER TABLE public.technical_projects
  ADD COLUMN IF NOT EXISTS request_category text,
  ADD COLUMN IF NOT EXISTS internal_client_code text;

ALTER TABLE public.technical_projects
  DROP CONSTRAINT IF EXISTS technical_projects_dates_chk;

ALTER TABLE public.technical_projects
  ALTER COLUMN planned_end_date DROP NOT NULL;

ALTER TABLE public.technical_projects
  ADD CONSTRAINT technical_projects_dates_chk
  CHECK (planned_end_date IS NULL OR planned_end_date >= start_date);

ALTER TABLE public.technical_projects
  DROP CONSTRAINT IF EXISTS technical_projects_request_category_chk;

ALTER TABLE public.technical_projects
  ADD CONSTRAINT technical_projects_request_category_chk
  CHECK (
    request_category IS NULL OR request_category IN (
      'hidraulico',
      'electrico',
      'gasodomestico',
      'albanileria',
      'acabados',
      'mantenimiento_general'
    )
  );

CREATE INDEX IF NOT EXISTS idx_technical_projects_request_category
  ON public.technical_projects(request_category);

CREATE INDEX IF NOT EXISTS idx_technical_projects_internal_client_code
  ON public.technical_projects(internal_client_code);

-- Trigger robusto para crear ficha financiera sin depender de ON CONFLICT
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.financial_records fr
    WHERE fr.technical_project_id = new.id
  ) THEN
    INSERT INTO public.financial_records (case_type, technical_project_id, estado_financiero)
    VALUES (case_kind, new.id, 'sin_cotizacion');
  END IF;

  RETURN new;
END;
$$;

-- Trigger robusto para requerimientos sin depender de ON CONFLICT
CREATE OR REPLACE FUNCTION public.create_financial_record_for_requerimiento()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.financial_records fr
    WHERE fr.requerimiento_id = new.id
  ) THEN
    INSERT INTO public.financial_records (case_type, requerimiento_id, estado_financiero)
    VALUES ('inmobiliaria', new.id, 'sin_cotizacion');
  END IF;

  RETURN new;
END;
$$;
