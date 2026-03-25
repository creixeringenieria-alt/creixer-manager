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

async function getProfilesAvailableColumns(admin: any): Promise<Set<string>> {
  const { data, error } = await admin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "profiles");

  if (error || !data) {
    return new Set();
  }

  return new Set((data as Array<{ column_name: string }>).map((row) => row.column_name));
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

  const rawUpdates: Record<string, unknown> = {
    full_name: textValue(formData, "full_name"),
    phone: textValue(formData, "phone"),
    document_type: textValue(formData, "document_type"),
    document_number: textValue(formData, "document_number"),
    is_active: formData.get("is_active") === "true",
    basic_data_locked: true,
    basic_data_locked_at: new Date().toISOString()
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
    rawUpdates.user_type = "colaborador_creixer";
    rawUpdates.organization_name = organizationName || "Creixer Ingeniería S.A.S.";
    rawUpdates.client_id = null;
  } else {
    if (!role || !externalRoles.includes(role)) {
      redirect("/dashboard/configuracion/usuarios?error=Rol%20externo%20inv%C3%A1lido%20para%20usuario%20inmobiliaria.");
    }
    if (!clientId) {
      redirect("/dashboard/configuracion/usuarios?error=Debes%20asociar%20una%20inmobiliaria%20para%20usuario%20externo.");
    }
    rawUpdates.user_type = "usuario_inmobiliaria";
    rawUpdates.organization_name = null;
    rawUpdates.client_id = clientId;
  }

  rawUpdates.role = role;

  const supabase = createAdminClient() as any;
  const availableColumns = await getProfilesAvailableColumns(supabase);
  const updates = Object.fromEntries(Object.entries(rawUpdates).filter(([key]) => availableColumns.has(key)));
  const { error } = await supabase.from("profiles").update(updates).eq("id", profileId);
  if (error) {
    redirect(`/dashboard/configuracion/usuarios?error=${encodeURIComponent(`No se pudo actualizar usuario: ${error.message}`)}`);
  }

  revalidatePath("/dashboard/configuracion/usuarios");
  revalidatePath("/dashboard/perfil");
  redirect("/dashboard/configuracion/usuarios?ok=Usuario%20actualizado.");
}
