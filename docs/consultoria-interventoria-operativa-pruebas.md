# Pruebas locales: consultoría/interventoría operativa

## 1) Migraciones

```bash
supabase db push
```

Migraciones relevantes:

- `20260317120000_modulo_proyectos_tecnicos.sql`
- `20260317132000_proyectos_documentos_y_tareas_operativas.sql`

## 2) Flujo recomendado de prueba

1. Ir a `/dashboard/proyectos-tecnicos`.
2. Crear proyecto tipo `consultoria` o `interventoria`.
3. Adjuntar documentos iniciales al crear:
   - convocatoria, términos, anexos, planos, etc.
4. Marcar `generar tareas base automáticamente`.
5. Abrir proyecto y validar:
   - tareas generadas con responsable/fecha/estado/prioridad
   - carga adicional de documentos en el detalle
6. Ir a `/dashboard/mis-tareas` con rol administrador:
   - ver tareas del equipo
   - ver tareas vencidas y próximas
7. Ir a `/dashboard/agenda-operativa/tiempo-real`:
   - filtrar por hoy/semana, responsable, tipo de proyecto y estado.

## 3) Validación de permisos

- `administrador` debe acceder a:
  - `/dashboard`
  - `/dashboard/mis-tareas`
  - `/dashboard/agenda-operativa`
  - `/dashboard/agenda-operativa/tiempo-real`
  - `/dashboard/proyectos-tecnicos`
  - `/dashboard/almacen`
  - `/dashboard/cotizaciones`
  - `/dashboard/requerimientos`

## 4) Branding

- Login muestra logo en `/public/logo-creixer.png`.
- Header dashboard muestra logo y navegación rápida.
