"use server";

import { redirect } from "next/navigation";

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
  const role = typeof profile?.role === "string" && isValidRole(profile.role) ? profile.role : null;
  if (!role) {
    console.warn("[auth][login] session created without valid profile role", { userId: data.user.id });
    redirect("/acceso-incompleto?error=Tu%20usuario%20no%20tiene%20perfil%20completo.");
  }

  redirect(getRoleHomePath(role));
}
