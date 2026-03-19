import { redirect } from "next/navigation";

import type { AppRole } from "@/lib/auth/roles";
import { isValidRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

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

  return { userId: user.id as string, role };
}

export async function requirePageAccess(allowedRoles: AppRole[], deniedPath: string, message: string): Promise<AppRole> {
  const { userId, role } = await getCurrentUserRole();

  if (!userId) {
    redirect(`/login?error=${encodeURIComponent("Debes iniciar sesión.")}`);
  }

  if (!role || !allowedRoles.includes(role)) {
    redirect(`${deniedPath}?error=${encodeURIComponent(message)}`);
  }

  return role as AppRole;
}

export async function requireActionAccess(
  allowedRoles: AppRole[],
  deniedPath: string,
  message: string
): Promise<AppRole> {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !role || !allowedRoles.includes(role)) {
    redirect(`${deniedPath}?error=${encodeURIComponent(message)}`);
  }

  return role as AppRole;
}

export function canAdministrarEstadoCotizacion(role: AppRole | null, estadoDestino: string | null) {
  if (!estadoDestino) {
    return true;
  }

  if (estadoDestino !== "aprobada_internamente" && estadoDestino !== "enviada") {
    return true;
  }

  return role === "administrador";
}
