-- Módulo catálogo de actividades + integración con cotizaciones

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'actividad_categoria'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.actividad_categoria AS ENUM (
      'impermeabilizacion',
      'electricidad',
      'hidraulica',
      'acabados',
      'mantenimiento_general'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.actividades_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_actividad text NOT NULL,
  descripcion_tecnica text,
  unidad text NOT NULL,
  precio_referencial numeric(14,2) NOT NULL DEFAULT 0,
  categoria public.actividad_categoria NOT NULL,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT actividades_precio_referencial_chk CHECK (precio_referencial >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_actividades_nombre_categoria_unique
  ON public.actividades_catalogo (lower(nombre_actividad), categoria);

CREATE INDEX IF NOT EXISTS idx_actividades_categoria ON public.actividades_catalogo(categoria);
CREATE INDEX IF NOT EXISTS idx_actividades_activa ON public.actividades_catalogo(activa);

DROP TRIGGER IF EXISTS set_actividades_catalogo_updated_at ON public.actividades_catalogo;
CREATE TRIGGER set_actividades_catalogo_updated_at
BEFORE UPDATE ON public.actividades_catalogo
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cotizacion_items_actividad_id_fkey'
  ) THEN
    ALTER TABLE public.cotizacion_items
      ADD CONSTRAINT cotizacion_items_actividad_id_fkey
      FOREIGN KEY (actividad_id)
      REFERENCES public.actividades_catalogo(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_cotizacion_items_actividad_fk ON public.cotizacion_items(actividad_id);

ALTER TABLE public.actividades_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_actividades_catalogo"
ON public.actividades_catalogo
FOR ALL
USING (public.current_user_role() = 'administrador')
WITH CHECK (public.current_user_role() = 'administrador');

CREATE POLICY "authenticated_read_actividades_catalogo"
ON public.actividades_catalogo
FOR SELECT
TO authenticated
USING (true);
