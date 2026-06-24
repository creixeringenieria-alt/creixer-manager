-- Permite clasificar adjuntos operativos de casos sin romper el enum compartido
-- de documentos técnicos.

ALTER TYPE public.project_document_type ADD VALUE IF NOT EXISTS 'evidencia_fotografica';
ALTER TYPE public.project_document_type ADD VALUE IF NOT EXISTS 'soporte_tecnico';
ALTER TYPE public.project_document_type ADD VALUE IF NOT EXISTS 'cotizacion_recibida';

NOTIFY pgrst, 'reload schema';
