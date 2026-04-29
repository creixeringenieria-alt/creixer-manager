"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { isComplementaryProfileComplete } from "@/lib/auth/profile-completion";
import { getRoleHomePath, isValidRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

function toText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function fail(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

export async function loginWithPasswordAction(formData: FormData) {
  const email = toText(formData, "email");
  const password = toText(formData, "password");

  if (!email || !password) {
    return fail("Debes ingresar correo y contraseña.");
  }

  const supabase = (await createClient()) as any;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data?.user) {
    return fail("No fue posible iniciar sesión. Verifica correo y contraseña.");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  const roleFromProfile = typeof profile?.role === "string" && isValidRole(profile.role) ? profile.role : null;
  const metadataRole =
    (typeof data.user.app_metadata?.role === "string" && isValidRole(data.user.app_metadata.role)
      ? data.user.app_metadata.role
      : null) ??
    (typeof data.user.user_metadata?.role === "string" && isValidRole(data.user.user_metadata.role)
      ? data.user.user_metadata.role
      : null);
  const role = roleFromProfile ?? metadataRole;
  if (!role) {
    console.warn("[auth][login] session created without valid profile role", { userId: data.user.id });
    redirect("/acceso-incompleto?error=Tu%20usuario%20no%20tiene%20perfil%20completo.");
  }

  if (role === "super_admin" || role === "administrador") {
    redirect(getRoleHomePath(role));
  }

  const { data: complementaryData } = await supabase
    .from("profile_complementary_data")
    .select(
      "fecha_nacimiento, grupo_sanguineo_rh, eps, arl, fondo_pension, fondo_cesantias, direccion_residencia, ciudad_residencia, contacto_emergencia_nombre, contacto_emergencia_telefono, parentesco_contacto_emergencia, observaciones_medicas_relevantes"
    )
    .eq("id", data.user.id)
    .maybeSingle();
  if (!isComplementaryProfileComplete(complementaryData)) {
    redirect("/dashboard/perfil/completar?error=Completa%20tu%20perfil%20laboral%20para%20continuar.");
  }

  redirect(getRoleHomePath(role));
}

export async function solicitarRecuperacionAction(formData: FormData) {
  const email = toText(formData, "email");
  if (!email) {
    redirect("/recuperar-acceso?error=Debes%20ingresar%20un%20correo.");
  }

  const supabase = (await createClient()) as any;
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "creixer-manager.vercel.app";
  const origin = `${proto}://${host}`;

  const firstAttempt = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/restablecer-contrasena`
  });

  let finalError = firstAttempt.error ?? null;
  if (finalError) {
    // Fallback: use Supabase SITE_URL in case redirectTo is not allow-listed yet.
    const retry = await supabase.auth.resetPasswordForEmail(email);
    finalError = retry.error ?? null;
  }

  if (finalError) {
    const detail = encodeURIComponent(finalError.message ?? "No fue posible enviar el enlace de recuperación.");
    redirect(`/recuperar-acceso?error=${detail}`);
  }

  redirect(
    `/login?ok=${encodeURIComponent(
      "Te enviamos un enlace de recuperación. Revisa tu correo para restablecer la contraseña."
    )}`
  );
}
