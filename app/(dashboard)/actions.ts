"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function logoutAction() {
  const supabase = (await createClient()) as any;
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("[auth][logout] signOut failed:", error.message);
    redirect("/login?error=No%20se%20pudo%20cerrar%20la%20sesi%C3%B3n.%20Intenta%20de%20nuevo.");
  }

  redirect("/login?ok=Sesi%C3%B3n%20cerrada%20correctamente.");
}
