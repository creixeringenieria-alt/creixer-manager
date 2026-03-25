-- Rol externo para portal de inmobiliarias y permisos de solo lectura.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'app_role'
      AND e.enumlabel = 'cliente_inmobiliaria'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'cliente_inmobiliaria';
  END IF;
END
$$;

INSERT INTO public.app_permissions (key, description) VALUES
  ('ver_casos_cliente', 'Ver casos de su propia inmobiliaria'),
  ('ver_detalle_caso_cliente', 'Ver detalle del caso de su inmobiliaria'),
  ('ver_documentos_cliente', 'Ver documentos del caso de su inmobiliaria'),
  ('ver_evidencias_cliente', 'Ver evidencias del caso de su inmobiliaria')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions(role, permission_key)
SELECT v.role::public.app_role, v.permission_key
FROM (
  VALUES
    ('cliente_inmobiliaria', 'ver_casos_cliente'),
    ('cliente_inmobiliaria', 'ver_detalle_caso_cliente'),
    ('cliente_inmobiliaria', 'ver_documentos_cliente'),
    ('cliente_inmobiliaria', 'ver_evidencias_cliente'),
    ('cliente', 'ver_casos_cliente'),
    ('cliente', 'ver_detalle_caso_cliente'),
    ('cliente', 'ver_documentos_cliente'),
    ('cliente', 'ver_evidencias_cliente')
) AS v(role, permission_key)
ON CONFLICT (role, permission_key) DO NOTHING;

