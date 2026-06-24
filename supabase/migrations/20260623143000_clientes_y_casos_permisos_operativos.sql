-- Permisos operativos para que perfiles internos gestionen clientes y casos.
-- Aplica a Julian/super_admin, Adriana/administrativo, Sebastian/gerente_operativo y Maria Piedad/contabilidad-contable.

INSERT INTO public.app_permissions (key, description) VALUES
  ('ver_clientes', 'Ver clientes y terceros'),
  ('crear_clientes', 'Crear clientes y terceros'),
  ('editar_clientes', 'Editar clientes y terceros'),
  ('eliminar_clientes', 'Eliminar clientes y terceros')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO public.role_permissions(role, permission_key)
SELECT v.role::public.app_role, v.permission_key
FROM (
  VALUES
    -- Clientes: roles internos administrativos y gerenciales.
    ('super_admin', 'ver_clientes'),
    ('super_admin', 'crear_clientes'),
    ('super_admin', 'editar_clientes'),
    ('super_admin', 'eliminar_clientes'),
    ('gerente_operativo', 'ver_clientes'),
    ('gerente_operativo', 'crear_clientes'),
    ('gerente_operativo', 'editar_clientes'),
    ('gerente_operativo', 'eliminar_clientes'),
    ('administrativo', 'ver_clientes'),
    ('administrativo', 'crear_clientes'),
    ('administrativo', 'editar_clientes'),
    ('administrativo', 'eliminar_clientes'),
    ('contable', 'ver_clientes'),
    ('contable', 'crear_clientes'),
    ('contable', 'editar_clientes'),
    ('contable', 'eliminar_clientes'),

    -- Casos: refuerzo para que contabilidad pueda apoyar creación/edición si la operación lo requiere.
    ('contable', 'crear_casos'),
    ('contable', 'editar_casos'),
    ('contable', 'cerrar_casos'),
    ('gerente_operativo', 'crear_casos'),
    ('gerente_operativo', 'editar_casos'),
    ('gerente_operativo', 'cerrar_casos'),
    ('administrativo', 'crear_casos'),
    ('administrativo', 'editar_casos'),
    ('administrativo', 'adjuntar_soportes'),

    -- Legado compatible.
    ('administrador', 'ver_clientes'),
    ('administrador', 'crear_clientes'),
    ('administrador', 'editar_clientes'),
    ('administrador', 'eliminar_clientes'),
    ('asistente', 'ver_clientes'),
    ('asistente', 'crear_clientes'),
    ('asistente', 'editar_clientes'),
    ('asistente', 'eliminar_clientes'),
    ('contabilidad', 'ver_clientes'),
    ('contabilidad', 'crear_clientes'),
    ('contabilidad', 'editar_clientes'),
    ('contabilidad', 'eliminar_clientes'),
    ('contabilidad', 'crear_casos'),
    ('contabilidad', 'editar_casos'),
    ('contabilidad', 'cerrar_casos')
) AS v(role, permission_key)
ON CONFLICT (role, permission_key) DO NOTHING;
