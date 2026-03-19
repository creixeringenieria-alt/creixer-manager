# Arquitectura de Datos - Catálogo de Actividades y Agenda del Técnico

## 1) Catálogo de actividades

### Objetivo

Centralizar actividades reutilizables para cotizaciones, con precio referencial y clasificación técnica.

### Entidad principal

- `actividades_catalogo`
  - `id`
  - `nombre_actividad`
  - `descripcion_tecnica`
  - `unidad`
  - `precio_referencial`
  - `categoria`
  - `activa`
  - `created_at`
  - `updated_at`

### Categorías iniciales

- `impermeabilizacion`
- `electricidad`
- `hidraulica`
- `acabados`
- `mantenimiento_general`

### Relación con cotizaciones

- `cotizacion_items.actividad_id` -> `actividades_catalogo.id` (FK)
- Al seleccionar actividad en UI de cotización:
  - precarga `descripcion_tecnica` -> `descripcion`
  - precarga `unidad`
  - precarga `precio_referencial` -> `valor_unitario`
- Usuario puede sobrescribir los valores antes de guardar.

## 2) Agenda del técnico en celular

### Objetivo

Permitir operación en campo con UI simple y acciones rápidas sobre tareas asignadas al técnico autenticado.

### Fuente de datos

- `agenda_operativa` (filtro: `tecnico_id = auth.uid()`)
- join con:
  - `requerimientos` (tipo/estado, descripción)
  - `clients` (cliente)
  - `properties` (dirección)

### Vista móvil

Ruta: `/dashboard/mis-tareas`

Secciones:

- Tareas de hoy
- Tareas de mañana

Campos por tarea:

- tipo de visita/reparación
- dirección
- cliente
- contacto
- observaciones logísticas
- estado actual

### Acciones de técnico

- marcar `en_camino`
- marcar `en_sitio`
- abrir reporte de visita
- subir fotos
- cerrar visita

### Seguridad

- Solo tareas del técnico autenticado.
- Sin datos administrativos/contables en esta vista.
- Actualizaciones de estado validadas por `tecnico_id = auth.uid()`.

## 3) Flujo operativo

1. Asistente agenda visita en `agenda_operativa`.
2. Técnico abre `/dashboard/mis-tareas` en celular.
3. Técnico cambia estado (`en_camino`/`en_sitio`).
4. Técnico abre reporte y carga evidencias.
5. Estados de agenda/requerimiento se sincronizan vía reglas ya implementadas.
