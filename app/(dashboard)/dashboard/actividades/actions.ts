"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActionAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

function toText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNumber(value: string | null, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function baseRedirect(formData: FormData) {
  const categoria = toText(formData, "filtro_categoria") ?? "";
  const activa = toText(formData, "filtro_activa") ?? "";
  return `/dashboard/actividades?categoria=${encodeURIComponent(categoria)}&activa=${encodeURIComponent(activa)}`;
}

export async function crearActividadAction(formData: FormData) {
  await requireActionAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede crear actividades."
  );

  const nombre = toText(formData, "nombre_actividad");
  const unidad = toText(formData, "unidad");
  const categoria = toText(formData, "categoria");

  if (!nombre || !unidad || !categoria) {
    return redirect(`/dashboard/actividades?error=${encodeURIComponent("Nombre, unidad y categoría son obligatorios.")}`);
  }

  const supabase = createAdminClient();

  const { error } = await supabase.from("actividades_catalogo").insert({
    nombre_actividad: nombre,
    descripcion_tecnica: toText(formData, "descripcion_tecnica"),
    unidad,
    precio_referencial: toNumber(toText(formData, "precio_referencial"), 0),
    categoria,
    activa: formData.get("activa") === "si"
  });

  if (error) {
    return redirect(`/dashboard/actividades?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/actividades");
  return redirect(`/dashboard/actividades?ok=${encodeURIComponent("Actividad creada.")}`);
}

export async function actualizarActividadAction(formData: FormData) {
  await requireActionAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede editar actividades."
  );

  const id = toText(formData, "id");

  if (!id) {
    return redirect(`/dashboard/actividades?error=${encodeURIComponent("No se pudo identificar la actividad.")}`);
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("actividades_catalogo")
    .update({
      nombre_actividad: toText(formData, "nombre_actividad"),
      descripcion_tecnica: toText(formData, "descripcion_tecnica"),
      unidad: toText(formData, "unidad"),
      precio_referencial: toNumber(toText(formData, "precio_referencial"), 0),
      categoria: toText(formData, "categoria"),
      activa: formData.get("activa") === "si"
    })
    .eq("id", id);

  if (error) {
    return redirect(`${baseRedirect(formData)}&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/actividades");
  return redirect(`${baseRedirect(formData)}&ok=${encodeURIComponent("Actividad actualizada.")}`);
}

export async function toggleActividadAction(formData: FormData) {
  await requireActionAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede activar/inactivar actividades."
  );

  const id = toText(formData, "id");
  const activa = toText(formData, "activa") === "si";

  if (!id) {
    return redirect(`/dashboard/actividades?error=${encodeURIComponent("No se pudo identificar la actividad.")}`);
  }

  const supabase = createAdminClient();

  const { error } = await supabase.from("actividades_catalogo").update({ activa: !activa }).eq("id", id);

  if (error) {
    return redirect(`${baseRedirect(formData)}&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/actividades");
  return redirect(`${baseRedirect(formData)}&ok=${encodeURIComponent("Estado de actividad actualizado.")}`);
}
