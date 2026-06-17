-- Ajustes operativos del alta de casos y normalizacion del cliente BYP.

UPDATE public.clients
SET
  name = 'BYP BIENES Y PROYECTOS SAS',
  client_type = 'Inmobiliaria',
  updated_at = now()
WHERE upper(btrim(name)) = 'BP BIENES Y PROYECTOS SAS';

UPDATE public.clients
SET
  client_type = 'Inmobiliaria',
  updated_at = now()
WHERE upper(btrim(name)) = 'BYP BIENES Y PROYECTOS SAS'
  AND (client_type IS NULL OR client_type <> 'Inmobiliaria');

