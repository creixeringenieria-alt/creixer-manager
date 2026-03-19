-- Extensión APU: estado activo/inactivo

ALTER TABLE public.apu_catalog
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_apu_catalog_activo ON public.apu_catalog(activo);
