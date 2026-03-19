-- Módulo de almacén y herramientas

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'inventory_movement_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.inventory_movement_type AS ENUM (
      'entrada_compra',
      'entrada_devolucion',
      'salida_caso',
      'salida_ajuste',
      'salida_perdida',
      'salida_dano',
      'ajuste_manual'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'tool_condition_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.tool_condition_status AS ENUM ('excelente', 'buena', 'regular', 'mala');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'tool_operational_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.tool_operational_status AS ENUM (
      'disponible',
      'asignada',
      'mantenimiento',
      'danada',
      'perdida',
      'fuera_servicio'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'tool_assignment_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.tool_assignment_status AS ENUM ('asignada', 'devuelta', 'vencida', 'danada');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.inventory_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.storage_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category_id uuid NOT NULL REFERENCES public.inventory_categories(id) ON DELETE RESTRICT,
  unit text NOT NULL,
  stock_current numeric(14,2) NOT NULL DEFAULT 0,
  stock_min numeric(14,2) NOT NULL DEFAULT 0,
  average_unit_cost numeric(14,2) NOT NULL DEFAULT 0,
  storage_location_id uuid REFERENCES public.storage_locations(id) ON DELETE SET NULL,
  qr_code text UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_items_stock_current_chk CHECK (stock_current >= 0),
  CONSTRAINT inventory_items_stock_min_chk CHECK (stock_min >= 0),
  CONSTRAINT inventory_items_average_cost_chk CHECK (average_unit_cost >= 0)
);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  movement_type public.inventory_movement_type NOT NULL,
  quantity numeric(14,2) NOT NULL,
  unit_cost numeric(14,2) NOT NULL DEFAULT 0,
  total_cost numeric(14,2) NOT NULL DEFAULT 0,
  case_id uuid REFERENCES public.requerimientos(id) ON DELETE SET NULL,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movements_unit_cost_chk CHECK (unit_cost >= 0)
);

CREATE TABLE IF NOT EXISTS public.tool_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  serial_number text,
  category_id uuid NOT NULL REFERENCES public.tool_categories(id) ON DELETE RESTRICT,
  purchase_date date,
  purchase_cost numeric(14,2),
  condition_status public.tool_condition_status NOT NULL DEFAULT 'buena',
  operational_status public.tool_operational_status NOT NULL DEFAULT 'disponible',
  storage_location_id uuid REFERENCES public.storage_locations(id) ON DELETE SET NULL,
  current_responsible_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  qr_code text UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tools_purchase_cost_chk CHECK (purchase_cost IS NULL OR purchase_cost >= 0)
);

CREATE TABLE IF NOT EXISTS public.tool_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid NOT NULL REFERENCES public.tools(id) ON DELETE RESTRICT,
  assigned_to_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  case_id uuid REFERENCES public.requerimientos(id) ON DELETE SET NULL,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  expected_return_at timestamptz,
  returned_at timestamptz,
  delivery_condition text,
  return_condition text,
  status public.tool_assignment_status NOT NULL DEFAULT 'asignada',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tool_assignments_return_dates_chk CHECK (returned_at IS NULL OR returned_at >= assigned_at)
);

CREATE TABLE IF NOT EXISTS public.tool_maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid NOT NULL REFERENCES public.tools(id) ON DELETE CASCADE,
  maintenance_type text NOT NULL,
  description text NOT NULL,
  maintenance_date date NOT NULL DEFAULT current_date,
  cost numeric(14,2),
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  next_maintenance_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tool_maintenance_cost_chk CHECK (cost IS NULL OR cost >= 0)
);

CREATE TABLE IF NOT EXISTS public.case_inventory_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.requerimientos(id) ON DELETE CASCADE,
  inventory_movement_id uuid NOT NULL REFERENCES public.inventory_movements(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_inventory_usage_unique UNIQUE (inventory_movement_id)
);

CREATE TABLE IF NOT EXISTS public.case_tool_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.requerimientos(id) ON DELETE CASCADE,
  tool_assignment_id uuid NOT NULL REFERENCES public.tool_assignments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_tool_usage_unique UNIQUE (tool_assignment_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_location ON public.inventory_items(storage_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_active ON public.inventory_items(active);
CREATE INDEX IF NOT EXISTS idx_inventory_items_stock_current ON public.inventory_items(stock_current);
CREATE INDEX IF NOT EXISTS idx_inventory_items_stock_min ON public.inventory_items(stock_min);
CREATE INDEX IF NOT EXISTS idx_inventory_items_qr ON public.inventory_items(qr_code);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON public.inventory_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON public.inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_case ON public.inventory_movements(case_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_work_order ON public.inventory_movements(work_order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON public.inventory_movements(created_at);

CREATE INDEX IF NOT EXISTS idx_tools_category ON public.tools(category_id);
CREATE INDEX IF NOT EXISTS idx_tools_operational_status ON public.tools(operational_status);
CREATE INDEX IF NOT EXISTS idx_tools_condition_status ON public.tools(condition_status);
CREATE INDEX IF NOT EXISTS idx_tools_location ON public.tools(storage_location_id);
CREATE INDEX IF NOT EXISTS idx_tools_current_responsible ON public.tools(current_responsible_id);
CREATE INDEX IF NOT EXISTS idx_tools_active ON public.tools(active);
CREATE INDEX IF NOT EXISTS idx_tools_qr ON public.tools(qr_code);

CREATE INDEX IF NOT EXISTS idx_tool_assignments_tool ON public.tool_assignments(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_assignments_assigned_to ON public.tool_assignments(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_tool_assignments_case ON public.tool_assignments(case_id);
CREATE INDEX IF NOT EXISTS idx_tool_assignments_work_order ON public.tool_assignments(work_order_id);
CREATE INDEX IF NOT EXISTS idx_tool_assignments_status ON public.tool_assignments(status);
CREATE INDEX IF NOT EXISTS idx_tool_assignments_assigned_at ON public.tool_assignments(assigned_at);

CREATE INDEX IF NOT EXISTS idx_tool_maintenance_tool ON public.tool_maintenance_logs(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_maintenance_date ON public.tool_maintenance_logs(maintenance_date);

CREATE INDEX IF NOT EXISTS idx_case_inventory_usage_case ON public.case_inventory_usage(case_id);
CREATE INDEX IF NOT EXISTS idx_case_tool_usage_case ON public.case_tool_usage(case_id);

DROP TRIGGER IF EXISTS set_inventory_categories_updated_at ON public.inventory_categories;
CREATE TRIGGER set_inventory_categories_updated_at
BEFORE UPDATE ON public.inventory_categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_storage_locations_updated_at ON public.storage_locations;
CREATE TRIGGER set_storage_locations_updated_at
BEFORE UPDATE ON public.storage_locations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_inventory_items_updated_at ON public.inventory_items;
CREATE TRIGGER set_inventory_items_updated_at
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_tool_categories_updated_at ON public.tool_categories;
CREATE TRIGGER set_tool_categories_updated_at
BEFORE UPDATE ON public.tool_categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_tools_updated_at ON public.tools;
CREATE TRIGGER set_tools_updated_at
BEFORE UPDATE ON public.tools
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_tool_assignments_updated_at ON public.tool_assignments;
CREATE TRIGGER set_tool_assignments_updated_at
BEFORE UPDATE ON public.tool_assignments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_stock numeric(14,2);
  current_avg_cost numeric(14,2);
  delta numeric(14,2);
  effective_unit_cost numeric(14,2);
  resulting_stock numeric(14,2);
BEGIN
  IF new.quantity = 0 THEN
    RAISE EXCEPTION 'La cantidad no puede ser cero';
  END IF;

  SELECT stock_current, average_unit_cost
  INTO current_stock, current_avg_cost
  FROM public.inventory_items
  WHERE id = new.item_id
  FOR UPDATE;

  IF current_stock IS NULL THEN
    RAISE EXCEPTION 'Item de inventario no encontrado';
  END IF;

  IF new.movement_type <> 'ajuste_manual' AND new.quantity < 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser positiva para este tipo de movimiento';
  END IF;

  IF new.movement_type IN ('entrada_compra', 'entrada_devolucion') THEN
    delta := abs(new.quantity);
    effective_unit_cost := CASE WHEN new.unit_cost > 0 THEN new.unit_cost ELSE current_avg_cost END;
  ELSIF new.movement_type = 'ajuste_manual' THEN
    delta := new.quantity;
    effective_unit_cost := CASE WHEN new.unit_cost > 0 THEN new.unit_cost ELSE current_avg_cost END;
  ELSE
    delta := -abs(new.quantity);
    effective_unit_cost := CASE WHEN new.unit_cost > 0 THEN new.unit_cost ELSE current_avg_cost END;
  END IF;

  resulting_stock := current_stock + delta;

  IF resulting_stock < 0 THEN
    RAISE EXCEPTION 'Stock insuficiente para el movimiento';
  END IF;

  IF new.movement_type IN ('entrada_compra', 'entrada_devolucion') AND delta > 0 THEN
    UPDATE public.inventory_items
    SET
      stock_current = resulting_stock,
      average_unit_cost = CASE
        WHEN resulting_stock = 0 THEN 0
        WHEN current_stock = 0 THEN effective_unit_cost
        ELSE ((current_stock * current_avg_cost) + (delta * effective_unit_cost)) / resulting_stock
      END,
      updated_at = now()
    WHERE id = new.item_id;
  ELSE
    UPDATE public.inventory_items
    SET stock_current = resulting_stock, updated_at = now()
    WHERE id = new.item_id;
  END IF;

  new.total_cost := abs(new.quantity) * effective_unit_cost;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_inventory_movement ON public.inventory_movements;
CREATE TRIGGER trg_apply_inventory_movement
BEFORE INSERT ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_movement();

CREATE OR REPLACE FUNCTION public.sync_case_inventory_usage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.case_id IS NOT NULL THEN
    INSERT INTO public.case_inventory_usage (case_id, inventory_movement_id)
    VALUES (new.case_id, new.id)
    ON CONFLICT (inventory_movement_id) DO NOTHING;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_case_inventory_usage ON public.inventory_movements;
CREATE TRIGGER trg_sync_case_inventory_usage
AFTER INSERT ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.sync_case_inventory_usage();

CREATE OR REPLACE FUNCTION public.sync_tool_state_from_assignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.status = 'asignada' AND new.returned_at IS NULL THEN
    UPDATE public.tools
    SET
      operational_status = 'asignada',
      current_responsible_id = new.assigned_to_user_id,
      updated_at = now()
    WHERE id = new.tool_id;
  ELSIF new.status = 'devuelta' OR new.returned_at IS NOT NULL THEN
    UPDATE public.tools
    SET
      operational_status = 'disponible',
      current_responsible_id = null,
      updated_at = now()
    WHERE id = new.tool_id;
  ELSIF new.status = 'danada' THEN
    UPDATE public.tools
    SET operational_status = 'danada', updated_at = now()
    WHERE id = new.tool_id;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tool_state_from_assignment ON public.tool_assignments;
CREATE TRIGGER trg_sync_tool_state_from_assignment
AFTER INSERT OR UPDATE OF status, returned_at, assigned_to_user_id ON public.tool_assignments
FOR EACH ROW EXECUTE FUNCTION public.sync_tool_state_from_assignment();

CREATE OR REPLACE FUNCTION public.sync_case_tool_usage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.case_id IS NOT NULL THEN
    INSERT INTO public.case_tool_usage (case_id, tool_assignment_id)
    VALUES (new.case_id, new.id)
    ON CONFLICT (tool_assignment_id) DO NOTHING;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_case_tool_usage ON public.tool_assignments;
CREATE TRIGGER trg_sync_case_tool_usage
AFTER INSERT ON public.tool_assignments
FOR EACH ROW EXECUTE FUNCTION public.sync_case_tool_usage();

ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_inventory_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_tool_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_asistentes_manage_inventory_categories"
ON public.inventory_categories
FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_storage_locations"
ON public.storage_locations
FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_inventory_items"
ON public.inventory_items
FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_inventory_movements"
ON public.inventory_movements
FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_tool_categories"
ON public.tool_categories
FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_tools"
ON public.tools
FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_tool_assignments"
ON public.tool_assignments
FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "tecnicos_read_tool_assignments"
ON public.tool_assignments
FOR SELECT
USING (assigned_to_user_id = auth.uid());

CREATE POLICY "admins_asistentes_manage_tool_maintenance_logs"
ON public.tool_maintenance_logs
FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_case_inventory_usage"
ON public.case_inventory_usage
FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "admins_asistentes_manage_case_tool_usage"
ON public.case_tool_usage
FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

INSERT INTO public.inventory_categories (name)
VALUES ('Electricidad'), ('Hidráulica'), ('Acabados'), ('Mantenimiento general')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.tool_categories (name)
VALUES ('Herramienta manual'), ('Herramienta eléctrica'), ('Equipo de seguridad')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.storage_locations (name, description)
VALUES ('Bodega principal', 'Bodega central de materiales y herramientas')
ON CONFLICT (name) DO NOTHING;
