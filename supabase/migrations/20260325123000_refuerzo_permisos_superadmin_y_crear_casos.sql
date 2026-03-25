-- Refuerzo de permisos operativos:
-- 1) super_admin con acceso total.
-- 2) gerente_operativo y administrativo con crear_casos garantizado.

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'super_admin'::public.app_role, p.key
FROM public.app_permissions p
ON CONFLICT (role, permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key)
VALUES
  ('gerente_operativo'::public.app_role, 'crear_casos'),
  ('administrativo'::public.app_role, 'crear_casos')
ON CONFLICT (role, permission_key) DO NOTHING;
