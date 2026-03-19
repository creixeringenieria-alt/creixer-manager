# Arquitectura - Creixer Manager

## 1) Arquitectura general

- `Next.js` como frontend y BFF ligero (App Router + Route Handlers).
- `Supabase Auth` para autenticación.
- `PostgreSQL (Supabase)` como base de datos transaccional.
- `Supabase Storage` para evidencias fotográficas.

## 2) Capas

- Presentación: páginas y componentes (`app/`, `components/`).
- Aplicación: casos de uso, validaciones y autorización por rol (`lib/auth/`).
- Infraestructura: acceso a Supabase (`lib/supabase/`).
- Datos: tablas relacionales con RLS (`supabase/migrations/`).

## 3) Módulos de dominio

- Identidad y acceso
- Clientes e inmuebles
- Mantenimiento
- Diagnóstico y cotización
- Ejecución (órdenes de trabajo)
- Evidencias

## 4) Flujo principal

1. Cliente crea requerimiento para un inmueble.
2. Administrador asigna técnico.
3. Técnico registra diagnóstico.
4. Administrador genera cotización (aprobación/rechazo).
5. Administrador emite orden de trabajo.
6. Técnico ejecuta y adjunta evidencias fotográficas.
7. Orden se cierra y queda historial.

## 5) Roles y permisos (alto nivel)

- `administrador`:
  - CRUD completo en clientes, inmuebles, requerimientos, diagnósticos, cotizaciones, órdenes, evidencias.
- `tecnico`:
  - Ver y actualizar requerimientos y órdenes asignadas.
  - Crear diagnósticos y subir evidencias asociadas.
- `cliente`:
  - Ver sus inmuebles, crear requerimientos y ver estado/cotizaciones/órdenes relacionadas.

## 6) Modelo de datos (resumen)

- `profiles` (extiende `auth.users`)
- `clients`
- `properties`
- `maintenance_requests`
- `technical_diagnostics`
- `quotes`
- `quote_items`
- `work_orders`
- `photo_evidences`

## 7) Seguridad

- RLS activo en todas las tablas de negocio.
- Políticas basadas en:
  - Usuario autenticado (`auth.uid()`).
  - Rol del usuario en `profiles`.
  - Relación del cliente con el recurso.
- Storage protegido por políticas en bucket `evidences`.

## 8) Escalabilidad técnica

- IDs UUID y timestamps en todas las entidades.
- Índices en FKs y columnas de filtrado (`status`, `client_id`, `assigned_technician_id`).
- Preparado para auditoría y trazabilidad futura.
