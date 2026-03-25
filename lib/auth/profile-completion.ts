export interface ComplementaryProfileData {
  fecha_nacimiento?: string | null;
  grupo_sanguineo_rh?: string | null;
  eps?: string | null;
  arl?: string | null;
  fondo_pension?: string | null;
  fondo_cesantias?: string | null;
  direccion_residencia?: string | null;
  ciudad_residencia?: string | null;
  contacto_emergencia_nombre?: string | null;
  contacto_emergencia_telefono?: string | null;
  parentesco_contacto_emergencia?: string | null;
  observaciones_medicas_relevantes?: string | null;
}

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export function isComplementaryProfileComplete(data: ComplementaryProfileData | null | undefined) {
  if (!data) {
    return false;
  }

  return (
    hasText(data.fecha_nacimiento) &&
    hasText(data.grupo_sanguineo_rh) &&
    hasText(data.eps) &&
    hasText(data.arl) &&
    hasText(data.fondo_pension) &&
    hasText(data.fondo_cesantias) &&
    hasText(data.direccion_residencia) &&
    hasText(data.ciudad_residencia) &&
    hasText(data.contacto_emergencia_nombre) &&
    hasText(data.contacto_emergencia_telefono) &&
    hasText(data.parentesco_contacto_emergencia)
  );
}
