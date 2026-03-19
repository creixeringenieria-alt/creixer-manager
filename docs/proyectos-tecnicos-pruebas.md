# Pruebas locales: módulo Proyectos Técnicos

## 1) Aplicar migraciones

```bash
supabase db push
```

La migración clave es:

- `20260317120000_modulo_proyectos_tecnicos.sql`

## 2) Iniciar aplicación

```bash
npm run dev
```

## 3) Flujo funcional recomendado

1. Entrar a `/dashboard/proyectos-tecnicos`.
2. Crear proyecto técnico (tipo mantenimiento/consultoria/interventoria).
3. Abrir detalle del proyecto.
4. Crear fases y tareas con responsable, fechas y avance.
5. Ir a Gantt: `/dashboard/proyectos-tecnicos/[id]/gantt`.
6. Registrar entregables.
7. Registrar seguimientos.
8. Registrar cantidades (sitio, modelo, calculada, diferencia).
9. Registrar elementos de interventoría (acta, revisión, no conformidad, hito).
10. Volver al dashboard del módulo y revisar alertas.

## 4) Validaciones esperadas

- Alertas se crean automáticamente por vencimientos o proximidad según tareas/entregables/seguimientos/interventoría.
- Se pueden marcar alertas como leídas.
- Responsable de tareas/entregables/seguimientos/interventoría se selecciona desde `profiles`.
- En Gantt se ven barras por fase y tarea con color por estado y señal de vencidas.

## 5) Branding

- Login usa `/public/logo-creixer.png`.
- Header del área dashboard muestra logo y navegación operativa.
