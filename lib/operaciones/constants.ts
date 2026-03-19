export const TIPOS_SERVICIO = [
  "visita_diagnostico",
  "visita_preliminar",
  "reparacion_directa"
] as const;

export const ESTADOS_REQUERIMIENTO = [
  "pendiente",
  "agendado",
  "en_visita",
  "visitado",
  "pendiente_cotizacion",
  "cotizado",
  "pendiente_aprobacion",
  "aprobado",
  "rechazado",
  "en_reparacion",
  "finalizado"
] as const;

export const PRIORIDADES_REQUERIMIENTO = ["baja", "media", "alta", "critica"] as const;

export const ESTADOS_AGENDA = [
  "programada",
  "confirmada",
  "en_camino",
  "en_sitio",
  "cerrada",
  "no_efectiva"
] as const;

export const RESULTADOS_VISITA = [
  "diagnostico_realizado",
  "reparacion_realizada",
  "no_acceso",
  "reprogramar",
  "requiere_materiales",
  "pendiente_aprobacion"
] as const;

export function generarCodigoRequerimiento() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return `REQ-${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}
