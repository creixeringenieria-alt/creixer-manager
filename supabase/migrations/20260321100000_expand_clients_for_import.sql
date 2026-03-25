-- Amplía public.clients para importación real de terceros sin romper relaciones existentes.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS client_type text;

-- Normaliza clasificación de terceros para operación y facturación.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clients_client_type_check'
      AND conrelid = 'public.clients'::regclass
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_client_type_check
      CHECK (
        client_type IS NULL
        OR client_type IN (
          'Inmobiliaria',
          'Empresa',
          'Persona natural',
          'Conjunto Residencial'
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_clients_client_type ON public.clients(client_type);
CREATE INDEX IF NOT EXISTS idx_clients_city ON public.clients(city);

