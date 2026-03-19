-- Capa documental corporativa: ordenes de reparación y actas de satisfacción

ALTER TABLE public.work_orders
  ALTER COLUMN request_id DROP NOT NULL;

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS requerimiento_id uuid REFERENCES public.requerimientos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS codigo_orden text,
  ADD COLUMN IF NOT EXISTS direccion_servicio text,
  ADD COLUMN IF NOT EXISTS contacto_nombre text,
  ADD COLUMN IF NOT EXISTS contacto_telefono text,
  ADD COLUMN IF NOT EXISTS alcance_trabajos text,
  ADD COLUMN IF NOT EXISTS recomendaciones text,
  ADD COLUMN IF NOT EXISTS firma_responsable_creixer text,
  ADD COLUMN IF NOT EXISTS fecha_documento date DEFAULT current_date;

CREATE UNIQUE INDEX IF NOT EXISTS idx_work_orders_codigo_orden_unique
  ON public.work_orders(codigo_orden)
  WHERE codigo_orden IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_orders_requerimiento_id
  ON public.work_orders(requerimiento_id);

CREATE TABLE IF NOT EXISTS public.actas_satisfaccion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_acta text NOT NULL UNIQUE,
  requerimiento_id uuid NOT NULL REFERENCES public.requerimientos(id) ON DELETE CASCADE,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  cliente_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  inmueble_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  fecha_acta date NOT NULL DEFAULT current_date,
  servicio_realizado text NOT NULL,
  resultado text,
  satisfaccion text NOT NULL DEFAULT 'satisfecho',
  observaciones text,
  firmado_por_nombre text,
  firmado_por_documento text,
  firmado_por_cargo text,
  firma_responsable_creixer text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT actas_satisfaccion_satisfaccion_chk CHECK (satisfaccion IN ('satisfecho', 'parcial', 'no_satisfecho'))
);

CREATE INDEX IF NOT EXISTS idx_actas_satisfaccion_requerimiento
  ON public.actas_satisfaccion(requerimiento_id);
CREATE INDEX IF NOT EXISTS idx_actas_satisfaccion_work_order
  ON public.actas_satisfaccion(work_order_id);
CREATE INDEX IF NOT EXISTS idx_actas_satisfaccion_cliente
  ON public.actas_satisfaccion(cliente_id);
CREATE INDEX IF NOT EXISTS idx_actas_satisfaccion_fecha
  ON public.actas_satisfaccion(fecha_acta);

DROP TRIGGER IF EXISTS set_actas_satisfaccion_updated_at ON public.actas_satisfaccion;
CREATE TRIGGER set_actas_satisfaccion_updated_at
BEFORE UPDATE ON public.actas_satisfaccion
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.actas_satisfaccion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_asistentes_manage_actas_satisfaccion"
ON public.actas_satisfaccion
FOR ALL
USING (public.current_user_role() IN ('administrador', 'asistente'))
WITH CHECK (public.current_user_role() IN ('administrador', 'asistente'));

CREATE POLICY "tecnicos_read_actas_satisfaccion"
ON public.actas_satisfaccion
FOR SELECT
USING (public.current_user_role() = 'tecnico');
