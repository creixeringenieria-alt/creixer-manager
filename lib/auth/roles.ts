export const APP_ROLES = ["administrador", "asistente", "tecnico", "contabilidad", "cliente"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export function isValidRole(role: string): role is AppRole {
  return APP_ROLES.includes(role as AppRole);
}

export function getRoleHomePath(role: AppRole | null) {
  switch (role) {
    case "tecnico":
      return "/dashboard/mis-tareas";
    case "contabilidad":
      return "/dashboard/finanzas";
    case "administrador":
    case "asistente":
    case "cliente":
    default:
      return "/dashboard";
  }
}
