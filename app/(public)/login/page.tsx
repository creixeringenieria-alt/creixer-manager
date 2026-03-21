import { redirect } from "next/navigation";

import { isValidRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { loginWithPasswordAction } from "./actions";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const supabase = (await createClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const role = typeof profile?.role === "string" && isValidRole(profile.role) ? profile.role : null;
    if (role) {
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

        <form action={loginWithPasswordAction} className="form-grid">
          <input type="email" name="email" placeholder="Correo" required />
          <input type="password" name="password" placeholder="Contraseña" required />
          <button type="submit">Iniciar sesión</button>
        </form>
      </div>
    </main>
  );
}
