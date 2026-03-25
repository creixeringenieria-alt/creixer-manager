// Roles oficiales (nuevo esquema).
export const CORE_APP_ROLES = [
  "super_admin",
  "gerente_operativo",
  "administrativo",
  "contable",
  "almacen",
  "lider_operativo",
  "tecnico",
  "cliente_inmobiliaria"
] as const;

// Compatibilidad legado: se mantienen para no romper usuarios existentes.
export const APP_ROLES = [
  ...CORE_APP_ROLES,
  "administrador",
  "asistente",
  "contabilidad",
  "cliente"
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export function isValidRole(role: string): role is AppRole {
  return APP_ROLES.includes(role as AppRole);
}

export function normalizeRole(role: AppRole | null): AppRole | null {
  if (!role) {
    return null;
  }

  switch (role) {
    case "administrador":
      return "super_admin";
    case "asistente":
      return "administrativo";
    case "contabilidad":
      return "contable";
    case "cliente":
      return "cliente_inmobiliaria";
    default:
      return role;
  }
}

export function getRoleHomePath(role: AppRole | null) {
  const normalized = normalizeRole(role);
  switch (normalized) {
    case "almacen":
      return "/dashboard/almacen";
    case "contable":
      return "/dashboard/finanzas";
    case "tecnico":
      return "/dashboard/mis-tareas";
    case "cliente_inmobiliaria":
      return "/dashboard/casos";
    case "super_admin":
    case "gerente_operativo":
    case "administrativo":
    case "lider_operativo":
    default:
      return "/dashboard";
  }
}
