-- Módulo APU y presupuesto de obra por proyecto técnico

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'apu_tipo' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.apu_tipo AS ENUM ('general', 'mantenimiento', 'consultoria', 'interventoria');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'apu_item_tipo' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.apu_item_tipo AS ENUM ('material', 'mano_obra', 'equipo');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.apu_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  unidad text NOT NULL,
  tipo public.apu_tipo NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.apu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apu_id uuid NOT NULL REFERENCES public.apu_catalog(id) ON DELETE CASCADE,
  tipo public.apu_item_tipo NOT NULL,
  descripcion text NOT NULL,
  cantidad numeric(14,4) NOT NULL DEFAULT 0,
  unidad text NOT NULL,
  costo_unitario numeric(14,2) NOT NULL DEFAULT 0,
  costo_total numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT apu_items_cantidad_chk CHECK (cantidad >= 0),
  CONSTRAINT apu_items_costos_chk CHECK (costo_unitario >= 0 AND costo_total >= 0)
);

CREATE TABLE IF NOT EXISTS public.project_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.technical_projects(id) ON DELETE CASCADE,
  apu_id uuid REFERENCES public.apu_catalog(id) ON DELETE SET NULL,
  capitulo text NOT NULL,
  actividad text NOT NULL,
  cantidad numeric(14,4) NOT NULL DEFAULT 0,
  unidad text NOT NULL,
  precio_unitario numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_budget_cantidad_chk CHECK (cantidad >= 0),
  CONSTRAINT project_budget_costos_chk CHECK (precio_unitario >= 0 AND total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_apu_catalog_tipo ON public.apu_catalog(tipo);
CREATE INDEX IF NOT EXISTS idx_apu_catalog_nombre ON public.apu_catalog(nombre);
CREATE INDEX IF NOT EXISTS idx_apu_items_apu_id ON public.apu_items(apu_id);
CREATE INDEX IF NOT EXISTS idx_apu_items_tipo ON public.apu_items(tipo);
CREATE INDEX IF NOT EXISTS idx_project_budget_project_id ON public.project_budget(project_id);
CREATE INDEX IF NOT EXISTS idx_project_budget_apu_id ON public.project_budget(apu_id);
CREATE INDEX IF NOT EXISTS idx_project_budget_capitulo ON public.project_budget(capitulo);

CREATE OR REPLACE FUNCTION public.calculate_apu_item_total()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.costo_total := COALESCE(NEW.cantidad, 0) * COALESCE(NEW.costo_unitario, 0);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apu_total_cost(target_apu_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(ai.costo_total), 0)
  FROM public.apu_items ai
  WHERE ai.apu_id = target_apu_id;
$$;

CREATE OR REPLACE FUNCTION public.calculate_project_budget_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  apu_cost numeric(14,2);
BEGIN
  IF NEW.apu_id IS NOT NULL THEN
    SELECT public.apu_total_cost(NEW.apu_id) INTO apu_cost;
    NEW.precio_unitario := COALESCE(apu_cost, 0);
  END IF;

  NEW.total := COALESCE(NEW.cantidad, 0) * COALESCE(NEW.precio_unitario, 0);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_project_budget_prices_from_apu()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_apu_id uuid;
BEGIN
  target_apu_id := COALESCE(NEW.apu_id, OLD.apu_id);

  UPDATE public.project_budget pb
  SET
    precio_unitario = public.apu_total_cost(pb.apu_id),
    total = COALESCE(pb.cantidad, 0) * public.apu_total_cost(pb.apu_id),
    updated_at = now()
  WHERE pb.apu_id = target_apu_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_apu_items_calculate_total ON public.apu_items;
CREATE TRIGGER trg_apu_items_calculate_total
BEFORE INSERT OR UPDATE OF cantidad, costo_unitario ON public.apu_items
FOR EACH ROW EXECUTE FUNCTION public.calculate_apu_item_total();

DROP TRIGGER IF EXISTS trg_project_budget_calculate_total ON public.project_budget;
CREATE TRIGGER trg_project_budget_calculate_total
BEFORE INSERT OR UPDATE OF apu_id, cantidad, precio_unitario ON public.project_budget
FOR EACH ROW EXECUTE FUNCTION public.calculate_project_budget_totals();

DROP TRIGGER IF EXISTS trg_apu_items_sync_project_budget ON public.apu_items;
CREATE TRIGGER trg_apu_items_sync_project_budget
AFTER INSERT OR UPDATE OF cantidad, costo_unitario OR DELETE ON public.apu_items
FOR EACH ROW EXECUTE FUNCTION public.sync_project_budget_prices_from_apu();

DROP TRIGGER IF EXISTS set_apu_catalog_updated_at ON public.apu_catalog;
CREATE TRIGGER set_apu_catalog_updated_at
BEFORE UPDATE ON public.apu_catalog
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_apu_items_updated_at ON public.apu_items;
CREATE TRIGGER set_apu_items_updated_at
BEFORE UPDATE ON public.apu_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_project_budget_updated_at ON public.project_budget;
CREATE TRIGGER set_project_budget_updated_at
BEFORE UPDATE ON public.project_budget
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.apu_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budget ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_asistentes_manage_apu_catalog"
ON public.apu_catalog FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_apu_items"
ON public.apu_items FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_project_budget"
ON public.project_budget FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "tecnicos_read_project_budget"
ON public.project_budget FOR SELECT
USING (public.current_user_role() = 'tecnico');
