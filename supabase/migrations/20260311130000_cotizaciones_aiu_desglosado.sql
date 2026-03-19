-- Ajustes módulo cotizaciones: AIU desglosado + IVA utilidad + estructura documental

-- Nuevos tipos de sección para documento final
DO $$
BEGIN
  BEGIN
    ALTER TYPE public.cotizacion_seccion_tipo ADD VALUE IF NOT EXISTS 'forma_pago';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER TYPE public.cotizacion_seccion_tipo ADD VALUE IF NOT EXISTS 'firma_final';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END
$$;

-- Configuración por cliente
ALTER TABLE public.configuracion_cotizacion_cliente
  ADD COLUMN IF NOT EXISTS porcentaje_administracion numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS porcentaje_imprevisto numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS porcentaje_utilidad numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS porcentaje_iva_utilidad numeric(5,2) NOT NULL DEFAULT 19,
  ADD COLUMN IF NOT EXISTS aplica_iva_sobre_utilidad boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cfg_pct_admin_rango_chk'
  ) THEN
    ALTER TABLE public.configuracion_cotizacion_cliente
      ADD CONSTRAINT cfg_pct_admin_rango_chk CHECK (porcentaje_administracion >= 0 AND porcentaje_administracion <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cfg_pct_imprevisto_rango_chk'
  ) THEN
    ALTER TABLE public.configuracion_cotizacion_cliente
      ADD CONSTRAINT cfg_pct_imprevisto_rango_chk CHECK (porcentaje_imprevisto >= 0 AND porcentaje_imprevisto <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cfg_pct_utilidad_rango_chk'
  ) THEN
    ALTER TABLE public.configuracion_cotizacion_cliente
      ADD CONSTRAINT cfg_pct_utilidad_rango_chk CHECK (porcentaje_utilidad >= 0 AND porcentaje_utilidad <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cfg_pct_iva_utilidad_rango_chk'
  ) THEN
    ALTER TABLE public.configuracion_cotizacion_cliente
      ADD CONSTRAINT cfg_pct_iva_utilidad_rango_chk CHECK (porcentaje_iva_utilidad >= 0 AND porcentaje_iva_utilidad <= 100);
  END IF;
END
$$;

-- Backfill mínimo: mantener continuidad con AIU anterior
UPDATE public.configuracion_cotizacion_cliente
SET porcentaje_utilidad = COALESCE(aiu_porcentaje_default, 0)
WHERE COALESCE(porcentaje_administracion, 0) = 0
  AND COALESCE(porcentaje_imprevisto, 0) = 0
  AND COALESCE(porcentaje_utilidad, 0) = 0
  AND COALESCE(aiu_porcentaje_default, 0) > 0;

-- Cotizaciones
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS porcentaje_administracion_base numeric(5,2),
  ADD COLUMN IF NOT EXISTS porcentaje_administracion_editado numeric(5,2),
  ADD COLUMN IF NOT EXISTS porcentaje_administracion_aplicado numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_administracion numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS porcentaje_imprevisto_base numeric(5,2),
  ADD COLUMN IF NOT EXISTS porcentaje_imprevisto_editado numeric(5,2),
  ADD COLUMN IF NOT EXISTS porcentaje_imprevisto_aplicado numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_imprevisto numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS porcentaje_utilidad_base numeric(5,2),
  ADD COLUMN IF NOT EXISTS porcentaje_utilidad_editado numeric(5,2),
  ADD COLUMN IF NOT EXISTS porcentaje_utilidad_aplicado numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_utilidad numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS porcentaje_iva_utilidad numeric(5,2) NOT NULL DEFAULT 19,
  ADD COLUMN IF NOT EXISTS aplica_iva_sobre_utilidad boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS valor_iva numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sin_iva numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS empresa_nombre text,
  ADD COLUMN IF NOT EXISTS direccion_servicio text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS marca_agua_texto text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cot_pct_admin_aplicado_rango_chk'
  ) THEN
    ALTER TABLE public.cotizaciones
      ADD CONSTRAINT cot_pct_admin_aplicado_rango_chk CHECK (porcentaje_administracion_aplicado >= 0 AND porcentaje_administracion_aplicado <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cot_pct_imprevisto_aplicado_rango_chk'
  ) THEN
    ALTER TABLE public.cotizaciones
      ADD CONSTRAINT cot_pct_imprevisto_aplicado_rango_chk CHECK (porcentaje_imprevisto_aplicado >= 0 AND porcentaje_imprevisto_aplicado <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cot_pct_utilidad_aplicado_rango_chk'
  ) THEN
    ALTER TABLE public.cotizaciones
      ADD CONSTRAINT cot_pct_utilidad_aplicado_rango_chk CHECK (porcentaje_utilidad_aplicado >= 0 AND porcentaje_utilidad_aplicado <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cot_pct_iva_utilidad_rango_chk'
  ) THEN
    ALTER TABLE public.cotizaciones
      ADD CONSTRAINT cot_pct_iva_utilidad_rango_chk CHECK (porcentaje_iva_utilidad >= 0 AND porcentaje_iva_utilidad <= 100);
  END IF;
END
$$;

-- Backfill mínimo desde AIU previo (asumido como utilidad)
UPDATE public.cotizaciones
SET
  porcentaje_utilidad_aplicado = COALESCE(aiu_porcentaje_aplicado, 0),
  porcentaje_utilidad_editado = COALESCE(aiu_porcentaje_editado, 0),
  valor_utilidad = COALESCE(aiu_valor, 0),
  total_sin_iva = COALESCE(subtotal, 0) + COALESCE(aiu_valor, 0)
WHERE COALESCE(porcentaje_administracion_aplicado, 0) = 0
  AND COALESCE(porcentaje_imprevisto_aplicado, 0) = 0
  AND COALESCE(porcentaje_utilidad_aplicado, 0) = 0
  AND COALESCE(aiu_porcentaje_aplicado, 0) > 0;

CREATE INDEX IF NOT EXISTS idx_cfg_cotizacion_pct_admin ON public.configuracion_cotizacion_cliente(porcentaje_administracion);
CREATE INDEX IF NOT EXISTS idx_cfg_cotizacion_pct_imprevisto ON public.configuracion_cotizacion_cliente(porcentaje_imprevisto);
CREATE INDEX IF NOT EXISTS idx_cfg_cotizacion_pct_utilidad ON public.configuracion_cotizacion_cliente(porcentaje_utilidad);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_pct_admin_aplicado ON public.cotizaciones(porcentaje_administracion_aplicado);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_pct_imprevisto_aplicado ON public.cotizaciones(porcentaje_imprevisto_aplicado);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_pct_utilidad_aplicado ON public.cotizaciones(porcentaje_utilidad_aplicado);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_aplica_iva_utilidad ON public.cotizaciones(aplica_iva_sobre_utilidad);
