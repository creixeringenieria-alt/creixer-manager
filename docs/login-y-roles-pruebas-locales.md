# Login y Pruebas de Roles (Local)

## 1) Ejecutar migraciones y app

```bash
supabase db push
npm run dev
```

## 2) Crear usuarios de prueba en Supabase Auth

Desde el dashboard de Supabase:

1. Ve a `Authentication > Users`.
2. Crea usuarios con correo/contraseña, por ejemplo:
   - `admin@creixer.test`
   - `asistente@creixer.test`
   - `tecnico@creixer.test`
   - `conta@creixer.test`

## 3) Asignar rol en `profiles`

Ejecuta en SQL Editor (ajusta correos reales):

```sql
update public.profiles
set role = 'administrador'
where id = (select id from auth.users where email = 'admin@creixer.test');

update public.profiles
set role = 'asistente'
where id = (select id from auth.users where email = 'asistente@creixer.test');

update public.profiles
set role = 'tecnico'
where id = (select id from auth.users where email = 'tecnico@creixer.test');

update public.profiles
set role = 'contabilidad'
where id = (select id from auth.users where email = 'conta@creixer.test');
```

## 4) Flujo esperado por rol

- `administrador`:
  - Login en `/login` -> redirección a `/dashboard`.
  - Acceso completo.

- `asistente`:
  - Login en `/login` -> redirección a `/dashboard`.
  - Puede requerimientos, agenda, actividades y cotizaciones (sin aprobar internamente/enviar).

- `tecnico`:
  - Login en `/login` -> redirección a `/dashboard/mis-tareas`.
  - Si entra a `/dashboard` redirige a `/dashboard/mis-tareas`.
  - Si intenta módulos administrativos, recibe acceso denegado.

- `contabilidad`:
  - Login en `/login` -> redirección a `/dashboard/facturacion`.
  - Si entra a `/dashboard` redirige a `/dashboard/facturacion`.
  - Solo módulos contables habilitados.

## 5) Validar rutas protegidas sin sesión

Sin iniciar sesión, abre una ruta protegida como `/dashboard/cotizaciones`:

- Debe redirigir a `/login` con mensaje de error.
