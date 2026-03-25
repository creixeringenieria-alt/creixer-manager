"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUserPermissions } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

function textValue(formData: FormData, key: string, required = false) {
  const value = formData.get(key);
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized && required) {
    return null;
  }
  return normalized || null;
}

export async function adminUpdateUserBasicDataAction(formData: FormData) {
  const { userId, normalizedRole } = await getCurrentUserPermissions();
  if (!userId) {
    redirect("/login?error=Debes%20iniciar%20sesi%C3%B3n.");
  }
  if (normalizedRole !== "super_admin") {
    redirect("/dashboard/configuracion/usuarios?error=No%20tienes%20permiso%20para%20editar%20usuarios.");
  }

  const profileId = textValue(formData, "id", true);
  if (!profileId) {
    redirect("/dashboard/configuracion/usuarios?error=Usuario%20inv%C3%A1lido.");
  }

  const updates: Record<string, unknown> = {
    full_name: textValue(formData, "full_name"),
    phone: textValue(formData, "phone"),
    document_type: textValue(formData, "document_type"),
    document_number: textValue(formData, "document_number"),
    is_active: formData.get("is_active") === "true"
  };

  const userTypeRaw = textValue(formData, "user_type") ?? "colaborador_creixer";
  const userType = userTypeRaw === "usuario_inmobiliaria" ? "usuario_inmobiliaria" : "colaborador_creixer";
  const organizationName = textValue(formData, "organization_name");
  const clientId = textValue(formData, "client_id");

  const role = textValue(formData, "role");
  const internalRoles = ["super_admin", "gerente_operativo", "administrativo", "contable", "contabilidad", "almacen", "tecnico"];
  const externalRoles = ["cliente_inmobiliaria"];

  if (userType === "colaborador_creixer") {
    if (!role || !internalRoles.includes(role)) {
      redirect("/dashboard/configuracion/usuarios?error=Rol%20interno%20inv%C3%A1lido%20para%20colaborador%20Creixer.");
    }
    updates.user_type = "colaborador_creixer";
    updates.organization_name = organizationName || "Creixer Ingeniería S.A.S.";
    updates.client_id = null;
  } else {
    if (!role || !externalRoles.includes(role)) {
      redirect("/dashboard/configuracion/usuarios?error=Rol%20externo%20inv%C3%A1lido%20para%20usuario%20inmobiliaria.");
    }
    if (!clientId) {
      redirect("/dashboard/configuracion/usuarios?error=Debes%20asociar%20una%20inmobiliaria%20para%20usuario%20externo.");
    }
    updates.user_type = "usuario_inmobiliaria";
    updates.organization_name = null;
    updates.client_id = clientId;
  }

  updates.role = role;

  const supabase = createAdminClient() as any;
  const { error } = await supabase.from("profiles").update(updates).eq("id", profileId);
  if (error) {
    redirect(`/dashboard/configuracion/usuarios?error=${encodeURIComponent(`No se pudo actualizar usuario: ${error.message}`)}`);
  }

  revalidatePath("/dashboard/configuracion/usuarios");
  revalidatePath("/dashboard/perfil");
  redirect("/dashboard/configuracion/usuarios?ok=Usuario%20actualizado.");
}
