# Pruebas locales: módulo Almacén y Herramientas

## 1) Aplicar migraciones

```bash
supabase db push
```

Esto crea tablas, enums, índices y triggers del módulo:

- `inventory_categories`
- `inventory_items`
- `storage_locations`
- `inventory_movements`
- `tool_categories`
- `tools`
- `tool_assignments`
- `tool_maintenance_logs`
- `case_inventory_usage`
- `case_tool_usage`

## 2) Iniciar app

```bash
npm run dev
```

## 3) Rutas del módulo

- `/dashboard/almacen` (dashboard del módulo)
- `/dashboard/almacen/materiales`
- `/dashboard/almacen/herramientas`
- `/dashboard/almacen/qr`
- `/dashboard/requerimientos/[id]/recursos`

## 4) Flujo sugerido de validación

1. Ir a `Materiales`:
   - crear categoría y ubicación
   - crear material con stock mínimo
   - registrar `entrada_compra`
   - registrar `salida_caso` con `case_id`
   - validar actualización automática de stock

2. Ir a `Herramientas`:
   - crear categoría y herramienta
   - asignar herramienta a técnico y/o caso
   - registrar devolución
   - registrar mantenimiento y validar cambio a estado `mantenimiento`

3. Ir a `Recursos por caso`:
   - abrir desde `Requerimientos` -> `Recursos`
   - registrar salida de material al caso
   - asignar herramienta al caso
   - validar listados de consumos y asignaciones

4. Ir a `Vista QR`:
   - consultar por `qr_code` o por `code`
   - validar detalle de material/herramienta

5. Ir a `Dashboard Almacén`:
   - revisar:
     - materiales con stock bajo
     - herramientas disponibles/asignadas/mantenimiento
     - costo de materiales del mes
     - casos con mayor consumo

## 5) Nota de operación

- Los movimientos de inventario aplican triggers que:
  - recalculan `stock_current`
  - recalculan costo promedio en entradas
  - generan error si el movimiento deja stock en negativo
- Las asignaciones de herramienta aplican triggers que sincronizan:
  - `tools.operational_status`
  - `tools.current_responsible_id`
