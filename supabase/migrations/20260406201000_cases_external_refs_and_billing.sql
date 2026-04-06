-- Referencias externas por inmobiliaria + configuración de facturación por caso.

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS external_property_code text,
  ADD COLUMN IF NOT EXISTS external_case_id text,
  ADD COLUMN IF NOT EXISTS external_case_code text,
  ADD COLUMN IF NOT EXISTS bill_to_assigned_client boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS billing_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_observations text;

CREATE INDEX IF NOT EXISTS idx_cases_external_property_code ON public.cases(external_property_code);
CREATE INDEX IF NOT EXISTS idx_cases_external_case_id ON public.cases(external_case_id);
CREATE INDEX IF NOT EXISTS idx_cases_external_case_code ON public.cases(external_case_code);
CREATE INDEX IF NOT EXISTS idx_cases_billing_client_id ON public.cases(billing_client_id);

ALTER TABLE public.cases
  DROP CONSTRAINT IF EXISTS cases_billing_logic_chk;

ALTER TABLE public.cases
  ADD CONSTRAINT cases_billing_logic_chk
  CHECK (
    (bill_to_assigned_client = true)
    OR (bill_to_assigned_client = false AND billing_client_id IS NOT NULL)
  );

NOTIFY pgrst, 'reload schema';
