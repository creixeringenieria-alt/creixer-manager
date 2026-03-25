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
      "full_name, role, client_id, user_type, organization_name, document_type, document_number, phone, is_active, clients(name), profile_complementary_data(fecha_nacimiento, grupo_sanguineo_rh, eps, arl, fondo_pension, fondo_cesantias, direccion_residencia, ciudad_residencia, contacto_emergencia_nombre, contacto_emergencia_telefono, parentesco_contacto_emergencia, observaciones_medicas_relevantes)"
    )
    .eq("id", user.id)
    .maybeSingle();

  const role = typeof profile?.role === "string" && isValidRole(profile.role) ? profile.role : null;
  if (profileError || !profile || !role) {
    redirect("/acceso-incompleto?error=Tu%20usuario%20no%20tiene%20perfil%20completo.");
  }

  const complementaryRaw = (profile.profile_complementary_data ??
    null) as ComplementaryProfileData | ComplementaryProfileData[] | null;
  const complementary = Array.isArray(complementaryRaw) ? complementaryRaw[0] ?? null : complementaryRaw;

  return {
    userId: user.id as string,
    email: (user.email as string | null) ?? null,
    fullName: (profile.full_name as string | null) ?? null,
    role,
    clientId: (profile.client_id as string | null) ?? null,
    clientName: ((profile.clients as { name?: string } | null)?.name as string | undefined) ?? null,
    documentType: (profile.document_type as string | null) ?? null,
    documentNumber: (profile.document_number as string | null) ?? null,
    phone: (profile.phone as string | null) ?? null,
    isActive: Boolean(profile.is_active ?? true),
    userType:
      profile.user_type === "usuario_inmobiliaria" || profile.user_type === "colaborador_creixer"
        ? profile.user_type
        : "colaborador_creixer",
    organizationName: (profile.organization_name as string | null) ?? null,
    complementary,
    profileComplete: isComplementaryProfileComplete(complementary)
  };
}
