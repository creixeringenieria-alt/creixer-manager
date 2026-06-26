-- Tipos operativos de documentos para adjuntos de casos.
-- Usados en edicion/creacion de casos: factura, informes, cotizacion y acta.

ALTER TYPE public.project_document_type ADD VALUE IF NOT EXISTS 'factura';
ALTER TYPE public.project_document_type ADD VALUE IF NOT EXISTS 'informe_final';
ALTER TYPE public.project_document_type ADD VALUE IF NOT EXISTS 'informe_visita';
ALTER TYPE public.project_document_type ADD VALUE IF NOT EXISTS 'cotizacion';
ALTER TYPE public.project_document_type ADD VALUE IF NOT EXISTS 'acta_satisfaccion';

NOTIFY pgrst, 'reload schema';
