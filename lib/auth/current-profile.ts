import { redirect } from "next/navigation";

import { isValidRole, type AppRole } from "@/lib/auth/roles";
import { isComplementaryProfileComplete, type ComplementaryProfileData } from "@/lib/auth/profile-completion";
import { createClient } from "@/lib/supabase/server";

interface CurrentProfileResult {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: AppRole;
  clientId: string | null;
  clientName: string | null;
  documentType: string | null;
  documentNumber: string | null;
  phone: string | null;
  isActive: boolean;
  basicDataLocked: boolean;
  basicDataLockedAt: string | null;
  userType: "colaborador_creixer" | "usuario_inmobiliaria";
  organizationName: string | null;
  complementary: ComplementaryProfileData | null;
  profileComplete: boolean;
}

export async function requireCurrentProfile(): Promise<CurrentProfileResult> {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login?error=Debes iniciar sesión.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "full_name, role, client_id, user_type, organization_name, document_type, document_number, phone, is_active, basic_data_locked, basic_data_locked_at, clients(name)"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[auth][current-profile] profiles lookup failed", profileError.message);
  }

  const roleFromProfile = typeof profile?.role === "string" && isValidRole(profile.role) ? profile.role : null;
  const metadataRole =
    (typeof user.app_metadata?.role === "string" && isValidRole(user.app_metadata.role)
      ? user.app_metadata.role
      : null) ??
    (typeof user.user_metadata?.role === "string" && isValidRole(user.user_metadata.role)
      ? user.user_metadata.role
      : null);
  const role = roleFromProfile ?? metadataRole;

  if (!role) {
    redirect("/acceso-incompleto?error=Tu%20usuario%20no%20tiene%20rol%20configurado.");
  }

  let complementary: ComplementaryProfileData | null = null;
  if (role === "super_admin" || role === "administrador") {
    const metaComplementary =
      typeof user.user_metadata?.complementary_profile === "object" && user.user_metadata?.complementary_profile
        ? (user.user_metadata.complementary_profile as ComplementaryProfileData)
        : null;
    complementary = metaComplementary;
  } else {
    const { data: complementaryData, error: complementaryError } = await supabase
      .from("profile_complementary_data")
      .select(
        "fecha_nacimiento, grupo_sanguineo_rh, eps, arl, fondo_pension, fondo_cesantias, direccion_residencia, ciudad_residencia, contacto_emergencia_nombre, contacto_emergencia_telefono, parentesco_contacto_emergencia, observaciones_medicas_relevantes"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (complementaryError) {
      console.error("[auth][current-profile] complementary profile lookup failed", complementaryError.message);
    }
    const dbComplementary = (complementaryData as ComplementaryProfileData | null) ?? null;
    const metaComplementary =
      typeof user.user_metadata?.complementary_profile === "object" && user.user_metadata?.complementary_profile
        ? (user.user_metadata.complementary_profile as ComplementaryProfileData)
        : null;
    complementary = dbComplementary ?? metaComplementary;
  }

  return {
    userId: user.id as string,
    email: (user.email as string | null) ?? null,
    fullName:
      (profile?.full_name as string | null) ??
      (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null) ??
      (typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null),
    role,
    clientId: (profile?.client_id as string | null) ?? null,
    clientName: ((profile?.clients as { name?: string } | null)?.name as string | undefined) ?? null,
    documentType: (profile?.document_type as string | null) ?? null,
    documentNumber: (profile?.document_number as string | null) ?? null,
    phone:
      (profile?.phone as string | null) ??
      (typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : null),
    isActive: Boolean(profile?.is_active ?? true),
    basicDataLocked: Boolean(profile?.basic_data_locked ?? false),
    basicDataLockedAt: (profile?.basic_data_locked_at as string | null) ?? null,
    userType:
      profile?.user_type === "usuario_inmobiliaria" || profile?.user_type === "colaborador_creixer"
        ? profile.user_type
        : "colaborador_creixer",
    organizationName: (profile?.organization_name as string | null) ?? null,
    complementary,
    profileComplete:
      role === "super_admin" || role === "administrador" ? true : isComplementaryProfileComplete(complementary)
  };
}
