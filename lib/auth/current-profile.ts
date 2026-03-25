import { redirect } from "next/navigation";

import { isValidRole, type AppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

interface CurrentProfileResult {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: AppRole;
  clientId: string | null;
  clientName: string | null;
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
    .select("full_name, role, client_id, clients(name)")
    .eq("id", user.id)
    .maybeSingle();

  const role = typeof profile?.role === "string" && isValidRole(profile.role) ? profile.role : null;
  if (profileError || !profile || !role) {
    redirect("/acceso-incompleto?error=Tu%20usuario%20no%20tiene%20perfil%20completo.");
  }

  return {
    userId: user.id as string,
    email: (user.email as string | null) ?? null,
    fullName: (profile.full_name as string | null) ?? null,
    role,
    clientId: (profile.client_id as string | null) ?? null,
    clientName: ((profile.clients as { name?: string } | null)?.name as string | undefined) ?? null
  };
}
