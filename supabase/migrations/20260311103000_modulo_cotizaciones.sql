-- Módulo de cotizaciones (documento técnico-comercial)

-- Enums de apoyo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'cotizacion_estado'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.cotizacion_estado AS ENUM (
      'borrador',
      'en_revision_interna',
      'lista_para_envio',
      'enviada',
      'ajustes_solicitados',
      'aprobada',
      'rechazada',
      'vencida'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'cotizacion_seccion_tipo'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.cotizacion_seccion_tipo AS ENUM (
      'introduccion',
      'objetivo_general',
      'objetivos_especificos',
      'diagnostico_preliminar',
      'alcance',
      'garantia',
      'tiempo_ejecucion',
      'notas_importantes'
    );
  END IF;
END
$$;

-- 1) Configuración por cliente
CREATE TABLE IF NOT EXISTS public.configuracion_cotizacion_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  aiu_porcentaje_default numeric(5,2) NOT NULL DEFAULT 0,
  garantia_default text,
  tiempo_ejecucion_default text,
  notas_importantes_default text,
  introduccion_default text,
  objetivo_general_default text,
  alcance_default text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cfg_cotizacion_aiu_rango_chk CHECK (aiu_porcentaje_default >= 0 AND aiu_porcentaje_default <= 100)
);

-- 2) Cotizaciones (cabecera y consolidado)
CREATE TABLE IF NOT EXISTS public.cotizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_cotizacion text NOT NULL UNIQUE,
  requerimiento_id uuid NOT NULL REFERENCES public.requerimientos(id) ON DELETE RESTRICT,
  cliente_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  inmueble_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  fecha_cotizacion date NOT NULL DEFAULT current_date,
  contacto_nombre text,
  contacto_telefono text,
  estado public.cotizacion_estado NOT NULL DEFAULT 'borrador',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  aiu_porcentaje_base_cliente numeric(5,2),
  aiu_porcentaje_editado numeric(5,2),
  aiu_porcentaje_aplicado numeric(5,2) NOT NULL DEFAULT 0,
  aiu_valor numeric(14,2) NOT NULL DEFAULT 0,
  total_final numeric(14,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'COP',
  valida_hasta date,
  version_actual integer NOT NULL DEFAULT 1,
  is_version_final boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cot_aiu_base_rango_chk CHECK (aiu_porcentaje_base_cliente IS NULL OR (aiu_porcentaje_base_cliente >= 0 AND aiu_porcentaje_base_cliente <= 100)),
  CONSTRAINT cot_aiu_editado_rango_chk CHECK (aiu_porcentaje_editado IS NULL OR (aiu_porcentaje_editado >= 0 AND aiu_porcentaje_editado <= 100)),
  CONSTRAINT cot_aiu_aplicado_rango_chk CHECK (aiu_porcentaje_aplicado >= 0 AND aiu_porcentaje_aplicado <= 100),
  CONSTRAINT cot_version_actual_chk CHECK (version_actual > 0)
);

-- 3) Secciones narrativas editables
CREATE TABLE IF NOT EXISTS public.cotizacion_secciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  tipo_seccion public.cotizacion_seccion_tipo NOT NULL,
  titulo text,
  contenido text,
  orden integer NOT NULL DEFAULT 1,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cotizacion_secciones_orden_chk CHECK (orden > 0)
);

-- 4) Items del presupuesto
CREATE TABLE IF NOT EXISTS public.cotizacion_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  item_numero integer NOT NULL,
  descripcion text NOT NULL,
  cantidad numeric(12,2) NOT NULL DEFAULT 1,
  unidad text,
  valor_unitario numeric(14,2) NOT NULL DEFAULT 0,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  actividad_id uuid,
  orden integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cotizacion_items_cantidad_chk CHECK (cantidad >= 0),
  CONSTRAINT cotizacion_items_item_numero_chk CHECK (item_numero > 0),
  CONSTRAINT cotizacion_items_orden_chk CHECK (orden > 0)
);

-- 5) Fotos de cotización
CREATE TABLE IF NOT EXISTS public.cotizacion_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  caption text,
  orden integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cotizacion_fotos_orden_chk CHECK (orden > 0)
);

-- 6) Versiones de documento/PDF
CREATE TABLE IF NOT EXISTS public.cotizacion_versiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  version_numero integer NOT NULL,
  snapshot_json jsonb NOT NULL,
  pdf_storage_path text,
  is_final boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cotizacion_versiones_numero_chk CHECK (version_numero > 0)
);

-- Índices recomendados
CREATE INDEX IF NOT EXISTS idx_cfg_cotizacion_cliente_cliente ON public.configuracion_cotizacion_cliente(cliente_id);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_requerimiento ON public.cotizaciones(requerimiento_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_cliente ON public.cotizaciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_inmueble ON public.cotizaciones(inmueble_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado ON public.cotizaciones(estado);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_fecha ON public.cotizaciones(fecha_cotizacion);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_created_by ON public.cotizaciones(created_by);

CREATE INDEX IF NOT EXISTS idx_cotizacion_secciones_cotizacion ON public.cotizacion_secciones(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_cotizacion_secciones_tipo ON public.cotizacion_secciones(tipo_seccion);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cotizacion_secciones_unique_tipo ON public.cotizacion_secciones(cotizacion_id, tipo_seccion);

CREATE INDEX IF NOT EXISTS idx_cotizacion_items_cotizacion ON public.cotizacion_items(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_cotizacion_items_actividad ON public.cotizacion_items(actividad_id);
CREATE INDEX IF NOT EXISTS idx_cotizacion_items_orden ON public.cotizacion_items(cotizacion_id, orden);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cotizacion_items_unique_numero ON public.cotizacion_items(cotizacion_id, item_numero);

CREATE INDEX IF NOT EXISTS idx_cotizacion_fotos_cotizacion ON public.cotizacion_fotos(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_cotizacion_fotos_orden ON public.cotizacion_fotos(cotizacion_id, orden);

CREATE INDEX IF NOT EXISTS idx_cotizacion_versiones_cotizacion ON public.cotizacion_versiones(cotizacion_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cotizacion_versiones_numero_unique ON public.cotizacion_versiones(cotizacion_id, version_numero);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cotizacion_versiones_final_unique ON public.cotizacion_versiones(cotizacion_id) WHERE is_final = true;

-- Triggers updated_at
DROP TRIGGER IF EXISTS set_configuracion_cotizacion_cliente_updated_at ON public.configuracion_cotizacion_cliente;
CREATE TRIGGER set_configuracion_cotizacion_cliente_updated_at
BEFORE UPDATE ON public.configuracion_cotizacion_cliente
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_cotizaciones_updated_at ON public.cotizaciones;
CREATE TRIGGER set_cotizaciones_updated_at
BEFORE UPDATE ON public.cotizaciones
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_cotizacion_secciones_updated_at ON public.cotizacion_secciones;
CREATE TRIGGER set_cotizacion_secciones_updated_at
BEFORE UPDATE ON public.cotizacion_secciones
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_cotizacion_items_updated_at ON public.cotizacion_items;
CREATE TRIGGER set_cotizacion_items_updated_at
BEFORE UPDATE ON public.cotizacion_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_cotizacion_fotos_updated_at ON public.cotizacion_fotos;
CREATE TRIGGER set_cotizacion_fotos_updated_at
BEFORE UPDATE ON public.cotizacion_fotos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_cotizacion_versiones_updated_at ON public.cotizacion_versiones;
CREATE TRIGGER set_cotizacion_versiones_updated_at
BEFORE UPDATE ON public.cotizacion_versiones
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
