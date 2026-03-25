-- Garantiza acceso total real para super_admin en toda la matriz de permisos.

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'super_admin'::public.app_role, p.key
FROM public.app_permissions p
ON CONFLICT (role, permission_key) DO NOTHING;

-- Compatibilidad para usuarios legacy con rol "administrador".
INSERT INTO public.role_permissions (role, permission_key)
SELECT 'administrador'::public.app_role, p.key
FROM public.app_permissions p
ON CONFLICT (role, permission_key) DO NOTHING;

