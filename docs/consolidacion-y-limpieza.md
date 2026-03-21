# Creixer Manager - Fase de Limpieza y Simplificación

Fecha: 2026-03-20

## 1) Limpieza aplicada

- Se centralizó la navegación en una sola fuente de verdad:
  - `lib/navigation/dashboard.ts`
- Se simplificó la navegación principal (header):
  - sin accesos duplicados
  - nombres cortos y operativos
  - ocultando rutas de compatibilidad/deprecated
- Se simplificó el dashboard de inicio:
  - tarjetas generadas desde la misma configuración de navegación
  - keys estables y únicas por `id`
- Se definió entrada única operativa:
  - ruta nueva: `/dashboard/casos/nuevo`
  - selección de tipo:
    - `mantenimiento`
    - `reparacion`
    - `consultoria`
    - `interventoria`
  - redirección al flujo especializado según tipo
- Se formalizó compatibilidad de roles legado:
  - `contabilidad` y `cliente` se conservan para no romper usuarios actuales
  - roles núcleo del producto: `administrador`, `asistente`, `tecnico`

## 2) Estado deprecated / compatibilidad

Rutas de compatibilidad (no aparecen en navegación principal):

- `/dashboard/agenda-operativa/tiempo-real`
  - estado: `deprecated`
  - reemplazo: `/dashboard/agenda-operativa`
- `/dashboard/facturacion`
  - estado: `deprecated`
  - reemplazo: `/dashboard/finanzas`
- `/dashboard/cartera`
  - estado: `deprecated`
  - reemplazo: `/dashboard/finanzas`

Elementos técnicos:
- Configurados como deprecated en `lib/navigation/dashboard.ts`.

## 3) Estructura final recomendada

Entidad madre operativa:

- **Caso/Proyecto** como entrada única.
- Selección de tipo en `/dashboard/casos/nuevo`.
- Derivación:
  - mantenimiento/reparación -> flujo requerimientos
  - consultoría/interventoría -> flujo proyectos técnicos

Flujo mantenimiento / inmobiliaria:

- caso -> visita -> diagnóstico/fotos -> cotización -> orden -> acta -> factura

Flujo consultoría / interventoría:

- proyecto -> documentos base -> fases/tareas -> Gantt -> seguimientos/visitas -> entregables -> control financiero -> factura

## 4) Rutas oficiales (uso recomendado)

Generales:
- `/dashboard`
- `/dashboard/casos`
- `/dashboard/casos/nuevo`
- `/dashboard/casos/[id]`

Operación mantenimiento:
- `/dashboard/requerimientos`
- `/dashboard/agenda-operativa`
- `/dashboard/mis-tareas`
- `/dashboard/reporte-visita`

Comercial:
- `/dashboard/cotizaciones`
- `/dashboard/ordenes-trabajo`
- `/dashboard/actas-satisfaccion`

Técnico / construcción:
- `/dashboard/proyectos-tecnicos`
- `/dashboard/presupuesto-obra`
- `/dashboard/apu`

Recursos:
- `/dashboard/almacen`

Finanzas:
- `/dashboard/finanzas`

## 5) Tablas legado que deben mantenerse solo en compatibilidad

En el estado actual del proyecto conviven estructuras antiguas y nuevas. Para crecimiento ordenado, nuevas funcionalidades deben montarse sobre el núcleo consolidado:

- Núcleo actual recomendado:
  - `requerimientos`
  - `technical_projects`
  - `financial_records`
  - `cotizaciones` y relacionadas
  - `agenda_operativa`, `reportes_visita`
  - `inventory_*`, `tools*`

- Tablas históricas/legado (compatibilidad):
  - `maintenance_requests`
  - `quotes`
  - `work_orders` (si no usa `requerimiento_id` en flujo nuevo, tratar como transición)
  - `photo_evidences`

## 6) Criterio de crecimiento congelado

- Toda nueva funcionalidad debe colgar de:
  - `requerimiento_id` o `technical_project_id`
  - y su `financial_record` asociado.
- Evitar crear módulos paralelos para facturación/cartera/agenda.
- Reutilizar navegación central en `lib/navigation/dashboard.ts`.
