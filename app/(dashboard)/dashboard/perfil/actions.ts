"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isValidRole, type AppRole } from "@/lib/auth/roles";

function textValue(formData: FormData, key: string, required = false) {
  const value = formData.get(key);
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized && required) {
    return null;
  }
  return normalized || null;
}

function sanitizeRedirect(path: FormDataEntryValue | null) {
  if (typeof path !== "string" || !path.startsWith("/dashboard/perfil")) {
    return "/dashboard/perfil";
  }
  return path;
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

function filterUpdatesByAvailableColumns(raw: Record<string, unknown>, availableColumns: Set<string>) {
  // Si no se pudo leer information_schema en este entorno, no filtrar.
  if (availableColumns.size === 0) {
    return raw;
  }
  return Object.fromEntries(Object.entries(raw).filter(([key]) => key === "id" || availableColumns.has(key)));
}

function getMissingColumnFromErrorMessage(message: string | undefined) {
  if (!message) return null;
  const match = message.match(/Could not find the '([^']+)' column/i);
  return match?.[1] ?? null;
}

async function upsertProfileWithFallback(admin: any, payload: Record<string, unknown>) {
  const updates = { ...payload };

  for (let i = 0; i < 8; i += 1) {
    const { error } = await admin.from("profiles").upsert(updates, { onConflict: "id" });
    if (!error) {
      return { error: null };
    }

    const missingColumn = getMissingColumnFromErrorMessage(error.message);
    if (!missingColumn || !(missingColumn in updates)) {
      return { error };
    }

    delete updates[missingColumn];
  }

  return { error: { message: "No se pudo guardar por columnas faltantes en profiles." } };
}

export async function updateOwnBasicProfileAction(formData: FormData) {
  const redirectTo = sanitizeRedirect(formData.get("redirect_to"));
  const supabase = (await createClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Debes%20iniciar%20sesi%C3%B3n.");
  }

  const admin = createAdminClient() as any;
  const availableColumns = await getProfilesAvailableColumns(admin);
  const { data: currentProfile } = await admin
    .from("profiles")
    .select("role, user_type, organization_name, client_id, basic_data_locked")
    .eq("id", user.id)
    .maybeSingle();
  const currentRole = typeof currentProfile?.role === "string" && isValidRole(currentProfile.role) ? currentProfile.role : null;
  const isSuperAdmin = currentRole === "super_admin" || currentRole === "administrador";
  const isLocked = Boolean(currentProfile?.basic_data_locked ?? false);

  if (isLocked && !isSuperAdmin) {
    redirect(`${redirectTo}?error=${encodeURIComponent("Tus datos básicos están bloqueados. Solo super_admin puede editarlos.")}`);
  }

  const metadataRole =
    (typeof user.app_metadata?.role === "string" && isValidRole(user.app_metadata.role)
      ? (user.app_metadata.role as AppRole)
      : null) ??
    (typeof user.user_metadata?.role === "string" && isValidRole(user.user_metadata.role)
      ? (user.user_metadata.role as AppRole)
      : null);
  const effectiveRole: AppRole = currentRole ?? metadataRole ?? "administrativo";

  const rawUpdates: Record<string, unknown> = {
    id: user.id,
    role: effectiveRole,
    user_type: currentProfile?.user_type ?? "colaborador_creixer",
    organization_name: currentProfile?.organization_name ?? "Creixer Ingeniería S.A.S.",
    client_id: currentProfile?.client_id ?? null,
    full_name: textValue(formData, "full_name"),
    phone: textValue(formData, "phone"),
    document_type: textValue(formData, "document_type"),
    document_number: textValue(formData, "document_number"),
    basic_data_locked: true,
    basic_data_locked_at: new Date().toISOString()
  };
  const updates = filterUpdatesByAvailableColumns(rawUpdates, availableColumns);

  const { error } = await upsertProfileWithFallback(admin, updates);
  if (error) {
    if (String(error.message ?? "").includes("document_number")) {
      redirect(
        `${redirectTo}?error=${encodeURIComponent(
          "No se pudo guardar número de documento porque falta la migración en Supabase. Ejecuta supabase db push."
        )}`
      );
    }
    redirect(`${redirectTo}?error=${encodeURIComponent(`No se pudo guardar datos básicos: ${error.message}`)}`);
  }

  revalidatePath("/dashboard/perfil");
  revalidatePath("/perfil");
  redirect(`${redirectTo}?ok=${encodeURIComponent("Datos básicos actualizados.")}`);
}

export async function updateOwnComplementaryProfileAction(formData: FormData) {
  const redirectTo = sanitizeRedirect(formData.get("redirect_to"));
  const supabase = (await createClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Debes%20iniciar%20sesi%C3%B3n.");
  }

  const payload = {
    id: user.id,
    fecha_nacimiento: textValue(formData, "fecha_nacimiento", true),
    grupo_sanguineo_rh: textValue(formData, "grupo_sanguineo_rh", true),
    eps: textValue(formData, "eps", true),
    arl: textValue(formData, "arl", true),
    fondo_pension: textValue(formData, "fondo_pension", true),
    fondo_cesantias: textValue(formData, "fondo_cesantias", true),
    direccion_residencia: textValue(formData, "direccion_residencia", true),
    ciudad_residencia: textValue(formData, "ciudad_residencia", true),
    contacto_emergencia_nombre: textValue(formData, "contacto_emergencia_nombre", true),
    contacto_emergencia_telefono: textValue(formData, "contacto_emergencia_telefono", true),
    parentesco_contacto_emergencia: textValue(formData, "parentesco_contacto_emergencia", true),
    observaciones_medicas_relevantes: textValue(formData, "observaciones_medicas_relevantes")
  };

  if (
    !payload.fecha_nacimiento ||
    !payload.grupo_sanguineo_rh ||
    !payload.eps ||
    !payload.arl ||
    !payload.fondo_pension ||
    !payload.fondo_cesantias ||
    !payload.direccion_residencia ||
    !payload.ciudad_residencia ||
    !payload.contacto_emergencia_nombre ||
    !payload.contacto_emergencia_telefono ||
    !payload.parentesco_contacto_emergencia
  ) {
    redirect(`${redirectTo}?error=${encodeURIComponent("Completa todos los campos obligatorios del perfil complementario.")}`);
  }

  const admin = createAdminClient() as any;
  const { error } = await admin.from("profile_complementary_data").upsert(payload, { onConflict: "id" });
  if (error) {
    redirect(`${redirectTo}?error=${encodeURIComponent(`No se pudo guardar perfil complementario: ${error.message}`)}`);
  }

  revalidatePath("/dashboard/perfil");
  revalidatePath("/dashboard/perfil/completar");
  revalidatePath("/perfil");

  if (redirectTo === "/dashboard/perfil/completar") {
    redirect("/dashboard?ok=Perfil%20completado%20correctamente.");
  }
  redirect(`${redirectTo}?ok=${encodeURIComponent("Perfil complementario actualizado.")}`);
}
