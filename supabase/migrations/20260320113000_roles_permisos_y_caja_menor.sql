-- Roles y permisos escalables + caja menor con soporte obligatorio.

-- 1) Extender enum de roles.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'app_role'
      AND e.enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'super_admin';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'app_role'
      AND e.enumlabel = 'gerente_operativo'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'gerente_operativo';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'app_role'
      AND e.enumlabel = 'administrativo'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'administrativo';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'app_role'
      AND e.enumlabel = 'contable'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'contable';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'app_role'
      AND e.enumlabel = 'almacen'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'almacen';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'app_role'
      AND e.enumlabel = 'lider_operativo'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'lider_operativo';
  END IF;
END
$$;

-- 2) Catálogo de permisos.
CREATE TABLE IF NOT EXISTS public.app_permissions (
  key text PRIMARY KEY,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Matriz rol-permiso.
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.app_role NOT NULL,
  permission_key text NOT NULL REFERENCES public.app_permissions(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role);

-- 4) Caja menor (soporte obligatorio).
CREATE TABLE IF NOT EXISTS public.petty_cash_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_record_id uuid REFERENCES public.financial_records(id) ON DELETE SET NULL,
  case_type text,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  expense_date date NOT NULL DEFAULT current_date,
  description text NOT NULL,
  support_url text NOT NULL,
  support_storage_path text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT petty_cash_support_required CHECK (
    length(trim(coalesce(support_url, ''))) > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_expenses_record ON public.petty_cash_expenses(financial_record_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_expenses_date ON public.petty_cash_expenses(expense_date);

DROP TRIGGER IF EXISTS set_petty_cash_expenses_updated_at ON public.petty_cash_expenses;
CREATE TRIGGER set_petty_cash_expenses_updated_at
BEFORE UPDATE ON public.petty_cash_expenses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Seed permisos.
INSERT INTO public.app_permissions (key, description) VALUES
  ('ver_casos', 'Ver casos/proyectos consolidados'),
  ('ver_casos_propios', 'Ver solo casos asignados al usuario'),
  ('crear_casos', 'Crear casos/requerimientos/proyectos'),
  ('editar_casos', 'Editar información del caso'),
  ('cerrar_casos', 'Cerrar caso/proyecto'),
  ('ver_finanzas', 'Ver módulo financiero'),
  ('registrar_gastos', 'Registrar gastos/caja menor'),
  ('adjuntar_soportes', 'Adjuntar soportes y evidencias'),
  ('ver_inventario', 'Ver inventario y herramientas'),
  ('asignar_tecnicos', 'Asignar técnicos a agenda y casos')
ON CONFLICT (key) DO NOTHING;

-- 6) Seed permisos por rol (nuevo + legado).
INSERT INTO public.role_permissions(role, permission_key)
SELECT v.role::public.app_role, v.permission_key
FROM (
  VALUES
    -- super_admin
    ('super_admin', 'ver_casos'),
    ('super_admin', 'ver_casos_propios'),
    ('super_admin', 'crear_casos'),
    ('super_admin', 'editar_casos'),
    ('super_admin', 'cerrar_casos'),
    ('super_admin', 'ver_finanzas'),
    ('super_admin', 'registrar_gastos'),
    ('super_admin', 'adjuntar_soportes'),
    ('super_admin', 'ver_inventario'),
    ('super_admin', 'asignar_tecnicos'),

    -- gerente_operativo
    ('gerente_operativo', 'ver_casos'),
    ('gerente_operativo', 'crear_casos'),
    ('gerente_operativo', 'editar_casos'),
    ('gerente_operativo', 'cerrar_casos'),
    ('gerente_operativo', 'ver_finanzas'),
    ('gerente_operativo', 'adjuntar_soportes'),
    ('gerente_operativo', 'ver_inventario'),
    ('gerente_operativo', 'asignar_tecnicos'),

    -- administrativo
    ('administrativo', 'ver_casos'),
    ('administrativo', 'crear_casos'),
    ('administrativo', 'editar_casos'),
    ('administrativo', 'adjuntar_soportes'),
    ('administrativo', 'asignar_tecnicos'),

    -- contable
    ('contable', 'ver_casos'),
    ('contable', 'ver_finanzas'),
    ('contable', 'registrar_gastos'),
    ('contable', 'adjuntar_soportes'),

    -- almacen
    ('almacen', 'ver_casos'),
    ('almacen', 'ver_inventario'),
    ('almacen', 'adjuntar_soportes'),

    -- lider_operativo
    ('lider_operativo', 'ver_casos'),
    ('lider_operativo', 'crear_casos'),
    ('lider_operativo', 'editar_casos'),
    ('lider_operativo', 'cerrar_casos'),
    ('lider_operativo', 'asignar_tecnicos'),

    -- tecnico
    ('tecnico', 'ver_casos_propios'),
    ('tecnico', 'adjuntar_soportes'),

    -- legado
    ('administrador', 'ver_casos'),
    ('administrador', 'ver_casos_propios'),
    ('administrador', 'crear_casos'),
    ('administrador', 'editar_casos'),
    ('administrador', 'cerrar_casos'),
    ('administrador', 'ver_finanzas'),
    ('administrador', 'registrar_gastos'),
    ('administrador', 'adjuntar_soportes'),
    ('administrador', 'ver_inventario'),
    ('administrador', 'asignar_tecnicos'),

    ('asistente', 'ver_casos'),
    ('asistente', 'crear_casos'),
    ('asistente', 'editar_casos'),
    ('asistente', 'adjuntar_soportes'),
    ('asistente', 'asignar_tecnicos'),

    ('contabilidad', 'ver_casos'),
    ('contabilidad', 'ver_finanzas'),
    ('contabilidad', 'registrar_gastos'),
    ('contabilidad', 'adjuntar_soportes')
) AS v(role, permission_key)
ON CONFLICT (role, permission_key) DO NOTHING;
