import { redirect } from "next/navigation";

import type { AppRole } from "@/lib/auth/roles";
import { isValidRole, normalizeRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const APP_PERMISSIONS = [
  "ver_casos",
  "ver_casos_propios",
  "crear_casos",
  "editar_casos",
  "cerrar_casos",
  "ver_finanzas",
  "registrar_gastos",
  "adjuntar_soportes",
  "ver_inventario",
  "asignar_tecnicos"
] as const;

export type AppPermission = (typeof APP_PERMISSIONS)[number];

const ROLE_PERMISSIONS_FALLBACK: Record<AppRole, AppPermission[]> = {
  super_admin: [...APP_PERMISSIONS],
  gerente_operativo: [
    "ver_casos",
    "crear_casos",
    "editar_casos",
    "cerrar_casos",
    "ver_finanzas",
    "adjuntar_soportes",
    "asignar_tecnicos",
    "ver_inventario"
  ],
  administrativo: ["ver_casos", "crear_casos", "editar_casos", "adjuntar_soportes", "asignar_tecnicos"],
  contable: ["ver_casos", "ver_finanzas", "registrar_gastos", "adjuntar_soportes"],
  almacen: ["ver_casos", "ver_inventario", "adjuntar_soportes"],
  lider_operativo: ["ver_casos", "crear_casos", "editar_casos", "cerrar_casos", "asignar_tecnicos"],
  tecnico: ["ver_casos_propios", "adjuntar_soportes"],

  // Legacy mapped.
  administrador: [...APP_PERMISSIONS],
  asistente: ["ver_casos", "crear_casos", "editar_casos", "adjuntar_soportes", "asignar_tecnicos"],
  contabilidad: ["ver_casos", "ver_finanzas", "registrar_gastos", "adjuntar_soportes"],
  cliente: []
};

const ROLE_HIERARCHY: Record<AppRole, AppRole[]> = {
  super_admin: ["super_admin"],
  gerente_operativo: ["super_admin", "gerente_operativo"],
  administrativo: ["super_admin", "gerente_operativo", "administrativo"],
  contable: ["super_admin", "gerente_operativo", "contable"],
  almacen: ["super_admin", "gerente_operativo", "almacen"],
  lider_operativo: ["super_admin", "gerente_operativo", "lider_operativo"],
  tecnico: ["super_admin", "gerente_operativo", "administrativo", "lider_operativo", "tecnico"],

  // Legacy
  administrador: ["super_admin"],
  asistente: ["super_admin", "gerente_operativo", "administrativo"],
  contabilidad: ["super_admin", "gerente_operativo", "contable"],
  cliente: ["cliente"]
};

export async function getCurrentUserRole(): Promise<{ userId: string | null; role: AppRole | null }> {
  const supabase = (await createClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { userId: null as string | null, role: null as AppRole | null };
  }

  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const roleFromProfile: AppRole | null =
    typeof data?.role === "string" && isValidRole(data.role) ? (data.role as AppRole) : null;
  const metaRole =
    (typeof user.app_metadata?.role === "string" && isValidRole(user.app_metadata.role)
      ? user.app_metadata.role
      : null) ??
    (typeof user.user_metadata?.role === "string" && isValidRole(user.user_metadata.role)
      ? user.user_metadata.role
      : null);
  const role: AppRole | null = roleFromProfile ?? (metaRole as AppRole | null);
  if (!role) {
    console.warn("[auth][permissions] authenticated user without role", { userId: user.id });
  }

  return { userId: user.id as string, role };
}

async function getPermissionsFromDb(role: AppRole | null): Promise<AppPermission[] | null> {
  if (!role) {
    return null;
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("role_permissions").select("permission_key").eq("role", role);
    if (error || !data) {
      if (error) {
        console.error("[auth][permissions] role_permissions query error", { role, error: error.message });
      }
      return null;
    }
    return data
      .map((row: { permission_key: string }) => row.permission_key)
      .filter((key): key is AppPermission => APP_PERMISSIONS.includes(key as AppPermission));
  } catch {
    console.error("[auth][permissions] role_permissions lookup failed unexpectedly", { role });
    return null;
  }
}

export async function getCurrentUserPermissions(): Promise<{
  userId: string | null;
  role: AppRole | null;
  normalizedRole: AppRole | null;
  permissions: AppPermission[];
}> {
  const { userId, role } = await getCurrentUserRole();
  const normalizedRole = normalizeRole(role);

  const roleForLookup = normalizedRole ?? role;
  const permissionsFromDb = await getPermissionsFromDb(roleForLookup);
  const fallback = roleForLookup ? ROLE_PERMISSIONS_FALLBACK[roleForLookup] ?? [] : [];

  return {
    userId,
    role,
    normalizedRole,
    permissions: permissionsFromDb && permissionsFromDb.length > 0 ? permissionsFromDb : fallback
  };
}

export async function hasPermission(permission: AppPermission): Promise<boolean> {
  const ctx = await getCurrentUserPermissions();
  return !!ctx.userId && ctx.permissions.includes(permission);
}

export async function requirePagePermission(
  permission: AppPermission,
  deniedPath: string,
  message: string
): Promise<{ userId: string; role: AppRole; normalizedRole: AppRole; permissions: AppPermission[] }> {
  const ctx = await getCurrentUserPermissions();

  if (!ctx.userId) {
    redirect(`/login?error=${encodeURIComponent("Debes iniciar sesión.")}`);
  }

  if (!ctx.role || !ctx.normalizedRole) {
    console.warn("[auth][permissions] missing role in requirePagePermission", { permission, userId: ctx.userId });
    redirect(`/acceso-incompleto?error=${encodeURIComponent("Tu usuario no tiene rol configurado.")}`);
  }

  if (!ctx.permissions.includes(permission)) {
    redirect(`${deniedPath}?error=${encodeURIComponent(message)}`);
  }

  return {
    userId: ctx.userId as string,
    role: ctx.role as AppRole,
    normalizedRole: ctx.normalizedRole as AppRole,
    permissions: ctx.permissions
  };
}

export async function requireActionPermission(
  permission: AppPermission,
  deniedPath: string,
  message: string
): Promise<{ userId: string; role: AppRole; normalizedRole: AppRole; permissions: AppPermission[] }> {
  const ctx = await getCurrentUserPermissions();
  if (!ctx.userId) {
    redirect(`/login?error=${encodeURIComponent("Debes iniciar sesión.")}`);
  }
  if (!ctx.role || !ctx.normalizedRole) {
    console.warn("[auth][permissions] missing role in requireActionPermission", { permission, userId: ctx.userId });
    redirect(`/acceso-incompleto?error=${encodeURIComponent("Tu usuario no tiene rol configurado.")}`);
  }
  if (!ctx.permissions.includes(permission)) {
    redirect(`${deniedPath}?error=${encodeURIComponent(message)}`);
  }
  return {
    userId: ctx.userId as string,
    role: ctx.role as AppRole,
    normalizedRole: ctx.normalizedRole as AppRole,
    permissions: ctx.permissions
  };
}

// Legacy wrappers (compatibilidad para código existente).
export async function requirePageAccess(allowedRoles: AppRole[], deniedPath: string, message: string): Promise<AppRole> {
  const { userId, role, normalizedRole } = await getCurrentUserPermissions();

  if (!userId) {
    redirect(`/login?error=${encodeURIComponent("Debes iniciar sesión.")}`);
  }

  const allowedNormalized = allowedRoles.map((r) => normalizeRole(r) ?? r);
  const current = normalizedRole ?? role;
  const satisfies = !!current && allowedNormalized.some((allowed) => ROLE_HIERARCHY[allowed]?.includes(current) ?? false);
  if (!satisfies) {
    redirect(`${deniedPath}?error=${encodeURIComponent(message)}`);
  }

  return (role ?? current) as AppRole;
}

export async function requireActionAccess(
  allowedRoles: AppRole[],
  deniedPath: string,
  message: string
): Promise<AppRole> {
  const { userId, role, normalizedRole } = await getCurrentUserPermissions();
  const allowedNormalized = allowedRoles.map((r) => normalizeRole(r) ?? r);
  const current = normalizedRole ?? role;
  const satisfies = !!current && allowedNormalized.some((allowed) => ROLE_HIERARCHY[allowed]?.includes(current) ?? false);
  if (!userId || !satisfies) {
    redirect(`${deniedPath}?error=${encodeURIComponent(message)}`);
  }
  return (role ?? current) as AppRole;
}

export function canAdministrarEstadoCotizacion(role: AppRole | null, estadoDestino: string | null) {
  if (!estadoDestino) {
    return true;
  }
  if (estadoDestino !== "aprobada_internamente" && estadoDestino !== "enviada") {
    return true;
  }
  return normalizeRole(role) === "super_admin";
}
