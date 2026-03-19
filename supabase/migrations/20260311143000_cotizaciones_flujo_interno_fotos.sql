-- Ajustes de flujo interno de cotizaciones y selección de fotos desde visitas/reportes

-- Estado de aprobación interna
DO $$
BEGIN
  BEGIN
    ALTER TYPE public.cotizacion_estado ADD VALUE IF NOT EXISTS 'aprobada_internamente';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END
$$;

-- Campo para marca de agua en archivo real
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS marca_agua_url text;

-- Trazabilidad de fotos incluidas desde reporte de visita
ALTER TABLE public.cotizacion_fotos
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS reporte_visita_foto_id uuid REFERENCES public.reporte_visita_fotos(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cotizacion_fotos_origen_chk'
  ) THEN
    ALTER TABLE public.cotizacion_fotos
      ADD CONSTRAINT cotizacion_fotos_origen_chk CHECK (origen IN ('manual', 'reporte_visita'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_cotizacion_fotos_origen ON public.cotizacion_fotos(origen);
CREATE INDEX IF NOT EXISTS idx_cotizacion_fotos_reporte_visita_foto_id ON public.cotizacion_fotos(reporte_visita_foto_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cotizacion_fotos_reporte_unique
  ON public.cotizacion_fotos(cotizacion_id, reporte_visita_foto_id)
  WHERE reporte_visita_foto_id IS NOT NULL;
