"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActionAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

function cleanValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parsePrefix(value: FormDataEntryValue | null) {
  const raw = cleanValue(value);

  if (!raw) {
    return null;
  }

  const normalized = raw.toUpperCase();

  if (!/^[A-Z0-9-]{2,12}$/.test(normalized)) {
    throw new Error("El prefijo documental debe tener 2-12 caracteres (A-Z, 0-9 o guion).");
  }

  return normalized;
}

function parseClientType(value: FormDataEntryValue | null) {
  const raw = cleanValue(value);
  if (!raw) return null;

  const allowed = ["Inmobiliaria", "Empresa", "Persona natural", "Conjunto Residencial"];
  if (!allowed.includes(raw)) {
    throw new Error("Tipo de cliente inválido.");
  }

  return raw;
}

function errorRedirect(message: string) {
  redirect(`/dashboard/clientes?error=${encodeURIComponent(message)}`);
}

function okRedirect(message: string) {
  redirect(`/dashboard/clientes?ok=${encodeURIComponent(message)}`);
}

export async function createClientAction(formData: FormData) {
  await requireActionAccess(["administrador"], "/dashboard", "Acceso denegado: tu rol no puede crear clientes.");

  try {
    const name = cleanValue(formData.get("name"));

    if (!name) {
      return errorRedirect("El nombre del cliente es obligatorio.");
    }

    const supabase = createAdminClient();

    const { error } = await supabase.from("clients").insert({
      name,
      client_type: parseClientType(formData.get("client_type")),
      tax_id: cleanValue(formData.get("tax_id")),
      contact_name: cleanValue(formData.get("contact_name")),
      contact_email: cleanValue(formData.get("contact_email")),
      contact_phone: cleanValue(formData.get("contact_phone")),
      documentary_prefix: parsePrefix(formData.get("documentary_prefix"))
    });

    if (error) {
      return errorRedirect(error.message);
    }

    revalidatePath("/dashboard/clientes");
    return okRedirect("Cliente creado.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error creando cliente.";
    return errorRedirect(message);
  }
}

export async function updateClientAction(formData: FormData) {
  await requireActionAccess(["administrador"], "/dashboard", "Acceso denegado: tu rol no puede editar clientes.");

  try {
    const id = cleanValue(formData.get("id"));
    const name = cleanValue(formData.get("name"));

    if (!id || !name) {
      return errorRedirect("Faltan datos para actualizar el cliente.");
    }

    const supabase = createAdminClient();

    const { error } = await supabase
      .from("clients")
      .update({
        name,
        client_type: parseClientType(formData.get("client_type")),
        tax_id: cleanValue(formData.get("tax_id")),
        contact_name: cleanValue(formData.get("contact_name")),
        contact_email: cleanValue(formData.get("contact_email")),
        contact_phone: cleanValue(formData.get("contact_phone")),
        documentary_prefix: parsePrefix(formData.get("documentary_prefix"))
      })
      .eq("id", id);

    if (error) {
      return errorRedirect(error.message);
    }

    revalidatePath("/dashboard/clientes");
    return okRedirect("Cliente actualizado.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error actualizando cliente.";
    return errorRedirect(message);
  }
}

export async function deleteClientAction(formData: FormData) {
  await requireActionAccess(["administrador"], "/dashboard", "Acceso denegado: tu rol no puede eliminar clientes.");

  const id = cleanValue(formData.get("id"));

  if (!id) {
    return errorRedirect("No se pudo identificar el cliente a eliminar.");
  }

  const supabase = createAdminClient();

  const { error } = await supabase.from("clients").delete().eq("id", id);

  if (error) {
    return errorRedirect(`No se pudo eliminar: ${error.message}`);
  }

  revalidatePath("/dashboard/clientes");
  return okRedirect("Cliente eliminado.");
}
