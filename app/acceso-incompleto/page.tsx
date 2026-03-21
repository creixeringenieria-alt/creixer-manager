import Link from "next/link";
import { redirect } from "next/navigation";

import { isValidRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

interface AccessIncompletePageProps {
  searchParams: Promise<{ error?: string }>;
}

async function cerrarSesionIncompletaAction() {
  "use server";

  const supabase = (await createClient()) as any;
  await supabase.auth.signOut();
  redirect("/login?error=Tu%20sesi%C3%B3n%20fue%20cerrada.%20Solicita%20asignaci%C3%B3n%20de%20rol.");
}

export default async function AccessIncompletePage({ searchParams }: AccessIncompletePageProps) {
  const params = await searchParams;
  const supabase = (await createClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Debes%20iniciar%20sesi%C3%B3n.");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = typeof profile?.role === "string" && isValidRole(profile.role) ? profile.role : null;

  if (role) {
    redirect("/dashboard");
  }

  return (
    <main className="login-main">
      <div className="card login-card">
        <img src="/logo-creixer.png" alt="Creixer Ingeniería" className="login-logo" />
        <h1>Acceso incompleto</h1>
        <p className="login-subtitle">Tu sesión está activa, pero falta perfil o rol en el sistema.</p>
        {params.error ? <p className="feedback error">{params.error}</p> : null}
        <p className="feedback">Solicita al administrador asignar un rol en `public.profiles` para tu usuario.</p>
        <form action={cerrarSesionIncompletaAction} className="form-grid">
          <button type="submit">Cerrar sesión</button>
        </form>
        <p style={{ marginTop: "0.8rem" }}>
          <Link href="/login">Volver al login</Link>
        </p>
      </div>
    </main>
  );
}
