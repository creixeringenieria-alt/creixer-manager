# Roles y permisos (simple, escalable y seguro)

## Roles oficiales

- `super_admin`
- `gerente_operativo`
- `administrativo`
- `contable`
- `almacen`
- `lider_operativo`
- `tecnico`

Compatibilidad legado (siguen funcionando):
- `administrador`
- `asistente`
- `contabilidad`
- `cliente`

## Permisos implementados

- `ver_casos`
- `ver_casos_propios`
- `crear_casos`
- `editar_casos`
- `cerrar_casos`
- `ver_finanzas`
- `registrar_gastos`
- `adjuntar_soportes`
- `ver_inventario`
- `asignar_tecnicos`

## Reglas clave aplicadas

- Técnico solo ve casos propios:
  - `/dashboard/casos` y `/dashboard/casos/[id]` filtran por asignación real (`agenda_operativa.tecnico_id` o `technical_project_tasks.responsible_user_id`).
- Caja menor requiere soporte obligatorio:
  - tabla `petty_cash_expenses` con `support_url NOT NULL` + `CHECK` de texto no vacío.
  - acción bloquea registro si no hay soporte.

## Tablas nuevas

- `app_permissions`
- `role_permissions`
- `petty_cash_expenses`

## Migración

Archivo:
- `supabase/migrations/20260320113000_roles_permisos_y_caja_menor.sql`

Aplicar:

```bash
supabase db push
```

## Asignar rol a usuario (ejemplo)

```sql
update public.profiles
set role = 'super_admin'
where id = '6747415e-2657-4267-8ce3-0857e93ce6e6';
```

Otro ejemplo:

```sql
update public.profiles
set role = 'tecnico'
where id = '<uuid-del-tecnico>';
```
