import { redirect } from "next/navigation";

import { isComplementaryProfileComplete } from "@/lib/auth/profile-completion";
import { isValidRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { loginWithPasswordAction } from "./actions";

interface LoginPageProps {
  searchParams: Promise<{ error?: string; ok?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const supabase = (await createClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const roleFromProfile = typeof profile?.role === "string" && isValidRole(profile.role) ? profile.role : null;
    const metadataRole =
      (typeof user.app_metadata?.role === "string" && isValidRole(user.app_metadata.role)
        ? user.app_metadata.role
        : null) ??
      (typeof user.user_metadata?.role === "string" && isValidRole(user.user_metadata.role)
        ? user.user_metadata.role
        : null);
    const role = roleFromProfile ?? metadataRole;
    if (role) {
      if (role === "super_admin" || role === "administrador") {
        redirect("/dashboard");
      }
      const { data: complementaryData } = await supabase
        .from("profile_complementary_data")
        .select(
          "fecha_nacimiento, grupo_sanguineo_rh, eps, arl, fondo_pension, fondo_cesantias, direccion_residencia, ciudad_residencia, contacto_emergencia_nombre, contacto_emergencia_telefono, parentesco_contacto_emergencia, observaciones_medicas_relevantes"
        )
        .eq("id", user.id)
        .maybeSingle();
      if (!isComplementaryProfileComplete(complementaryData)) {
        redirect("/dashboard/perfil/completar");
      }
      redirect("/dashboard");
    }
    redirect("/acceso-incompleto?error=Tu%20sesi%C3%B3n%20no%20tiene%20rol%20v%C3%A1lido.");
  }

  return (
    <main className="login-main">
      <div className="card login-card">
        <img src="/logo-creixer.png" alt="Creixer Ingeniería" className="login-logo" />
        <h1>Creixer Manager</h1>
        <p className="login-subtitle">Plataforma operativa y gerencial de Creixer Ingeniería</p>

        {params.error ? <p className="feedback error">{params.error}</p> : null}
        {params.ok ? <p className="feedback success">{params.ok}</p> : null}

        <form action={loginWithPasswordAction} className="form-grid">
          <input type="email" name="email" placeholder="Correo" required />
          <input type="password" name="password" placeholder="Contraseña" required />
          <button type="submit">Iniciar sesión</button>
        </form>
      </div>
    </main>
  );
}
