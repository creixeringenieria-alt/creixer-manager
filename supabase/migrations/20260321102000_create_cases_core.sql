-- Núcleo operativo: casos ligados a clientes.

CREATE TABLE IF NOT EXISTS public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  title text,
  description text,
  status text NOT NULL DEFAULT 'pendiente',
  priority text NOT NULL DEFAULT 'media',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cases_client_id ON public.cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_priority ON public.cases(priority);

DROP TRIGGER IF EXISTS set_cases_updated_at ON public.cases;
CREATE TRIGGER set_cases_updated_at
BEFORE UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

