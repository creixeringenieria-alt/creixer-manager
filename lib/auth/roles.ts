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

function canonicalizeRole(role: string | null | undefined): AppRole | null {
  if (!role) {
    return null;
  }

  const raw = role.trim();
  if (!raw) {
    return null;
  }

  if (APP_ROLES.includes(raw as AppRole)) {
    return raw as AppRole;
  }

  const normalized = raw.toLowerCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, AppRole> = {
    superadmin: "super_admin",
    super_admin: "super_admin",
    administrador: "administrador",
    gerente_operativo: "gerente_operativo",
    administrativo: "administrativo",
    contable: "contable",
    contabilidad: "contabilidad",
    almacen: "almacen",
    lider_operativo: "lider_operativo",
    tecnico: "tecnico",
    asistente: "asistente",
    cliente: "cliente",
    cliente_inmobiliaria: "cliente_inmobiliaria"
  };

  return aliases[normalized] ?? null;
}

export function isValidRole(role: string): role is AppRole {
  return canonicalizeRole(role) !== null;
}

export function normalizeRole(role: AppRole | string | null): AppRole | null {
  const canonical = typeof role === "string" ? canonicalizeRole(role) : role;
  if (!canonical) {
    return null;
  }

  switch (canonical) {
    case "administrador":
      return "super_admin";
    case "asistente":
      return "administrativo";
    case "contabilidad":
      return "contable";
    case "cliente":
      return "cliente_inmobiliaria";
    default:
      return canonical;
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
