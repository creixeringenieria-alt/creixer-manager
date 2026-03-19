# Módulo de Cotizaciones - Diseño Funcional y de Datos

## Objetivo

Definir la cotización como un **documento técnico-comercial estructurado**, editable por secciones, con trazabilidad de versiones y salida final en PDF.

## Estructura fija del documento

Toda cotización debe construirse con esta plantilla base (editable):

1. Encabezado:
- código de cotización
- fecha
- cliente
- inmueble
- dirección
- contacto

2. Introducción
3. Objetivo general
4. Objetivos específicos (opcional)
5. Diagnóstico preliminar
6. Alcance
7. Presupuesto (tabla):
- Ítem
- Descripción
- Cant.
- Und.
- Vr Unitario
- Vr Total

8. Subtotal
9. AIU editable
- valor sugerido desde configuración del cliente
- editable manualmente en la cotización

10. Total final
11. Garantía
12. Tiempo de ejecución
13. Notas importantes
14. Registro fotográfico adjunto

## Reglas funcionales

- Debe existir una **plantilla profesional fija** para no redactar desde cero.
- Cada sección narrativa es editable de forma independiente.
- Debe existir vista previa completa del documento antes de emitir.
- Debe generarse un documento final único (versión final bloqueada).
- Debe permitir exportación a PDF por versión.
- Debe almacenar:
  - textos narrativos,
  - ítems del presupuesto,
  - fotos anexas,
  - PDF generado.

## Modelo de datos propuesto

## 1) `configuracion_cotizacion_cliente`

Configuración por cliente para precargar condiciones comerciales.

Campos sugeridos:

- `id`
- `cliente_id` (unique)
- `aiu_porcentaje_default`
- `garantia_default`
- `tiempo_ejecucion_default`
- `notas_importantes_default`
- `introduccion_default`
- `objetivo_general_default`
- `alcance_default`
- `updated_at`

## 2) `cotizaciones`

Cabecera y consolidado de la cotización.

Campos sugeridos:

- `id`
- `codigo_cotizacion` (único)
- `requerimiento_id`
- `cliente_id`
- `inmueble_id`
- `fecha_cotizacion`
- `contacto_nombre`
- `contacto_telefono`
- `estado`
- `subtotal`
- `aiu_porcentaje_base_cliente`
- `aiu_porcentaje_editado`
- `aiu_porcentaje_aplicado`
- `aiu_valor`
- `total_final`
- `moneda`
- `valida_hasta`
- `version_actual`
- `is_version_final`
- `created_by`
- `created_at`
- `updated_at`

## 3) `cotizacion_secciones`

Almacena secciones narrativas editables.

Campos sugeridos:

- `id`
- `cotizacion_id`
- `tipo_seccion` (`introduccion`, `objetivo_general`, `objetivos_especificos`, `diagnostico_preliminar`, `alcance`, `garantia`, `tiempo_ejecucion`, `notas_importantes`)
- `titulo`
- `contenido`
- `orden`
- `updated_by`
- `updated_at`

## 4) `cotizacion_items`

Detalle económico editable (presupuesto).

Campos sugeridos:

- `id`
- `cotizacion_id`
- `item_numero`
- `descripcion`
- `cantidad`
- `unidad`
- `valor_unitario`
- `valor_total`
- `actividad_id` (opcional)
- `orden`

## 5) `cotizacion_fotos`

Registro fotográfico de soporte.

Campos sugeridos:

- `id`
- `cotizacion_id`
- `storage_path`
- `caption`
- `orden`
- `created_at`

## 6) `cotizacion_versiones`

Historial para trazabilidad y documento final único.

Campos sugeridos:

- `id`
- `cotizacion_id`
- `version_numero`
- `snapshot_json` (estructura completa congelada)
- `pdf_storage_path`
- `is_final`
- `created_by`
- `created_at`

## Flujo de estados sugerido

- `borrador`
- `en_revision_interna`
- `lista_para_envio`
- `enviada`
- `ajustes_solicitados`
- `aprobada`
- `rechazada`
- `vencida`

Reglas:

- Al pasar a `enviada`, se genera versión con PDF.
- Solo una versión puede marcarse `is_final = true`.
- Si hay ajustes, se crea nueva versión incremental.

## Cálculo económico

- `subtotal` = suma(`cotizacion_items.valor_total`)
- `aiu_porcentaje_aplicado`:
  - usa manual si existe,
  - si no, usa default del cliente.
- `aiu_valor` = `subtotal * aiu_porcentaje_aplicado / 100`
- `total_final` = `subtotal + aiu_valor`

## Filtros funcionales requeridos

- fecha (rango)
- cliente
- inmueble
- técnico responsable del requerimiento
- estado cotización
- tipo de servicio
- cotizaciones con o sin aprobación

