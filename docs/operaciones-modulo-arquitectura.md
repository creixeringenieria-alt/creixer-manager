# Arquitectura de Datos - Módulos Operativos

## Objetivo

Soportar el flujo operativo real:

1. Asistente crea requerimiento.
2. Asistente agenda visita/reparación.
3. Técnico consulta agenda (especialmente día siguiente).
4. Técnico registra reporte + evidencias.
5. El estado del requerimiento cambia automáticamente.

## Entidades

### 1) `requerimientos`

Caso principal reportado por la inmobiliaria.

Campos clave:

- `codigo_requerimiento` (único)
- `cliente_id` -> `clients.id`
- `inmueble_id` -> `properties.id`
- `contacto_nombre`, `contacto_telefono`
- `descripcion`
- `canal_ingreso` (default `WhatsApp`)
- `tipo_servicio` (`visita_diagnostico`, `visita_preliminar`, `reparacion_directa`)
- `prioridad` (`baja`, `media`, `alta`, `critica`)
- `estado` (ciclo operativo completo)
- `fecha_reporte`
- `observaciones_internas`

### 2) `agenda_operativa`

Programación de visitas/reparaciones sobre un requerimiento.

Campos clave:

- `requerimiento_id` -> `requerimientos.id`
- `tecnico_id` -> `profiles.id`
- `fecha_programada`, `franja_horaria`
- `tipo_visita`
- `direccion`, `contacto`
- `observaciones_logisticas`
- `estado_agenda`

### 3) `reportes_visita`

Cierre técnico de una agenda (1 reporte por agenda).

Campos clave:

- `agenda_id` (único) -> `agenda_operativa.id`
- `hora_llegada`, `hora_salida`
- `resultado_visita`
- `diagnostico_tecnico`
- `actividades_recomendadas`
- `requiere_cotizacion`, `se_reparo_en_sitio`
- `observaciones`

### 4) `reporte_visita_fotos`

Evidencias asociadas al reporte.

Campos clave:

- `reporte_visita_id` -> `reportes_visita.id`
- `storage_path` (ruta en Supabase Storage)
- `descripcion`

## Reglas de estado automáticas

- Al crear agenda: `requerimiento.estado` pasa a `agendado`.
- Si agenda está `en_camino` o `en_sitio`: `requerimiento.estado` pasa a `en_visita`.
- Al registrar reporte: `agenda.estado_agenda` pasa a `cerrada`.
- Resultado del reporte define `requerimiento.estado`:
  - `reparacion_realizada` o `se_reparo_en_sitio = true` -> `finalizado`
  - `diagnostico_realizado` + `requiere_cotizacion = true` -> `pendiente_cotizacion`
  - `diagnostico_realizado` sin cotización -> `visitado`
  - `pendiente_aprobacion` -> `pendiente_aprobacion`
  - `requiere_materiales` -> `pendiente_aprobacion`
  - `no_acceso` / `reprogramar` -> `agendado`

## Seguridad

- RLS habilitado en las 4 tablas nuevas.
- Políticas para:
  - Administrador: control total.
  - Técnico: ver/actualizar agenda asignada y reportes asociados.
  - Cliente: solo lectura de requerimientos propios.

## Integración con UI

- `Requerimientos`: formulario + listado.
- `Agenda operativa`: asignación + listado + vista de mañana.
- `Reporte de visita`: formulario con carga de fotos en bucket `evidences`.

