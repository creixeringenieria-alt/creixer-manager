"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActionPermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

function cleanValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "1";
}

function fail(message: string): never {
  redirect(`/dashboard/inmobiliarias?error=${encodeURIComponent(message)}`);
}

function ok(message: string): never {
  redirect(`/dashboard/inmobiliarias?ok=${encodeURIComponent(message)}`);
}

export async function crearInmobiliariaAction(formData: FormData) {
  await requireActionPermission("crear_casos", "/dashboard", "Acceso denegado para crear inmobiliarias.");

  const name = cleanValue(formData.get("name"));
  if (!name) {
    return fail("El nombre de la inmobiliaria es obligatorio.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("clients").insert({
    name,
    client_type: "Inmobiliaria",
    tax_id: cleanValue(formData.get("tax_id")),
    contact_name: cleanValue(formData.get("contact_name")),
    contact_email: cleanValue(formData.get("contact_email")),
    contact_phone: cleanValue(formData.get("contact_phone")),
    is_active: true
  });

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/dashboard/inmobiliarias");
  return ok("Inmobiliaria creada.");
}

export async function actualizarInmobiliariaAction(formData: FormData) {
  await requireActionPermission("editar_casos", "/dashboard", "Acceso denegado para editar inmobiliarias.");

  const id = cleanValue(formData.get("id"));
  const name = cleanValue(formData.get("name"));
  if (!id || !name) {
    return fail("Faltan datos para actualizar la inmobiliaria.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("clients")
    .update({
      name,
      client_type: "Inmobiliaria",
      tax_id: cleanValue(formData.get("tax_id")),
      contact_name: cleanValue(formData.get("contact_name")),
      contact_email: cleanValue(formData.get("contact_email")),
      contact_phone: cleanValue(formData.get("contact_phone")),
      is_active: toBoolean(formData.get("is_active"))
    })
    .eq("id", id);

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/dashboard/inmobiliarias");
  return ok("Inmobiliaria actualizada.");
}
