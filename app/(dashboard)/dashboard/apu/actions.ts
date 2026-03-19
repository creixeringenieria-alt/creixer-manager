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

function backTo(formData: FormData, fallback: string) {
  return toText(formData, "return_path") ?? fallback;
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function ok(path: string, message: string): never {
  redirect(`${path}?ok=${encodeURIComponent(message)}`);
}

export async function crearApuCatalogAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado para crear APU.");

  const path = backTo(formData, "/dashboard/apu");
  const nombre = toText(formData, "nombre");
  const unidad = toText(formData, "unidad");
  const tipo = toText(formData, "tipo") ?? "general";

  if (!nombre || !unidad) {
    return fail(path, "Nombre y unidad son obligatorios.");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("apu_catalog")
    .insert({ nombre, unidad, tipo })
    .select("id")
    .single();

  if (error || !data) {
    return fail(path, error?.message ?? "No se pudo crear el APU.");
  }

  revalidatePath("/dashboard/apu");
  return ok(`/dashboard/apu/${data.id}`, "APU creado.");
}

export async function actualizarApuCatalogAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado para editar APU.");

  const apuId = toText(formData, "id");
  const path = backTo(formData, apuId ? `/dashboard/apu/${apuId}` : "/dashboard/apu");
  const nombre = toText(formData, "nombre");
  const unidad = toText(formData, "unidad");
  const tipo = toText(formData, "tipo");

  if (!apuId || !nombre || !unidad || !tipo) {
    return fail(path, "ID, nombre, unidad y tipo son obligatorios.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("apu_catalog")
    .update({
      nombre,
      unidad,
      tipo,
      activo: toText(formData, "activo") !== "no"
    })
    .eq("id", apuId);

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/apu");
  revalidatePath(`/dashboard/apu/${apuId}`);
  return ok(path, "APU actualizado.");
}

export async function cambiarEstadoApuCatalogAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado para cambiar estado APU.");

  const apuId = toText(formData, "id");
  const path = backTo(formData, "/dashboard/apu");
  if (!apuId) {
    return fail(path, "No se pudo identificar el APU.");
  }

  const activo = toText(formData, "activo") === "si";
  const supabase = createAdminClient();
  const { error } = await supabase.from("apu_catalog").update({ activo }).eq("id", apuId);
  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/apu");
  revalidatePath(`/dashboard/apu/${apuId}`);
  return ok(path, activo ? "APU activado." : "APU inactivado.");
}

export async function duplicarApuCatalogAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado para duplicar APU.");

  const apuId = toText(formData, "id");
  const path = backTo(formData, "/dashboard/apu");
  if (!apuId) {
    return fail(path, "No se pudo identificar el APU a duplicar.");
  }

  const supabase = createAdminClient();
  const [apuResp, itemsResp] = await Promise.all([
    supabase.from("apu_catalog").select("id, nombre, unidad, tipo, activo").eq("id", apuId).maybeSingle(),
    supabase
      .from("apu_items")
      .select("tipo, descripcion, cantidad, unidad, costo_unitario")
      .eq("apu_id", apuId)
      .order("created_at", { ascending: true })
  ]);

  if (!apuResp.data) {
    return fail(path, "No existe el APU base.");
  }

  const { data: newApu, error: newApuError } = await supabase
    .from("apu_catalog")
    .insert({
      nombre: `${apuResp.data.nombre} (copia)`,
      unidad: apuResp.data.unidad,
      tipo: apuResp.data.tipo,
      activo: apuResp.data.activo
    })
    .select("id")
    .single();

  if (newApuError || !newApu) {
    return fail(path, newApuError?.message ?? "No se pudo duplicar el APU.");
  }

  const items = itemsResp.data ?? [];
  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("apu_items").insert(
      items.map((item) => ({
        apu_id: newApu.id,
        tipo: item.tipo,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        unidad: item.unidad,
        costo_unitario: item.costo_unitario
      }))
    );

    if (itemsError) {
      return fail(path, itemsError.message);
    }
  }

  revalidatePath("/dashboard/apu");
  revalidatePath(`/dashboard/apu/${apuId}`);
  return ok(`/dashboard/apu/${newApu.id}`, "APU duplicado correctamente.");
}

export async function eliminarApuCatalogAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado para eliminar APU.");

  const apuId = toText(formData, "id");
  const path = backTo(formData, "/dashboard/apu");
  if (!apuId) {
    return fail(path, "No se pudo identificar el APU.");
  }

  const supabase = createAdminClient();
  const { data: usage } = await supabase
    .from("project_budget")
    .select("id")
    .eq("apu_id", apuId)
    .limit(1);

  if ((usage ?? []).length > 0) {
    return fail(path, "No se puede eliminar: el APU está asociado a presupuestos de proyecto.");
  }

  const { error } = await supabase.from("apu_catalog").delete().eq("id", apuId);
  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/apu");
  return ok("/dashboard/apu", "APU eliminado.");
}

export async function crearApuItemAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado para crear ítems APU.");

  const apuId = toText(formData, "apu_id");
  const path = backTo(formData, apuId ? `/dashboard/apu/${apuId}` : "/dashboard/apu");
  const descripcion = toText(formData, "descripcion");
  const tipo = toText(formData, "tipo");
  const unidad = toText(formData, "unidad");

  if (!apuId || !descripcion || !tipo || !unidad) {
    return fail(path, "APU, tipo, descripción y unidad son obligatorios.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("apu_items").insert({
    apu_id: apuId,
    tipo,
    descripcion,
    cantidad: toNumber(toText(formData, "cantidad"), 0),
    unidad,
    costo_unitario: toNumber(toText(formData, "costo_unitario"), 0)
  });

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath(`/dashboard/apu/${apuId}`);
  revalidatePath("/dashboard/apu");
  revalidatePath("/dashboard/proyectos-tecnicos");
  return ok(path, "Ítem APU agregado.");
}

export async function actualizarApuItemAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado para editar ítems APU.");

  const id = toText(formData, "id");
  const apuId = toText(formData, "apu_id");
  const path = backTo(formData, apuId ? `/dashboard/apu/${apuId}` : "/dashboard/apu");
  if (!id || !apuId) {
    return fail(path, "No se pudo identificar el ítem.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("apu_items")
    .update({
      tipo: toText(formData, "tipo"),
      descripcion: toText(formData, "descripcion"),
      cantidad: toNumber(toText(formData, "cantidad"), 0),
      unidad: toText(formData, "unidad"),
      costo_unitario: toNumber(toText(formData, "costo_unitario"), 0)
    })
    .eq("id", id);

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath(`/dashboard/apu/${apuId}`);
  revalidatePath("/dashboard/apu");
  return ok(path, "Ítem APU actualizado.");
}

export async function eliminarApuItemAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado para eliminar ítems APU.");

  const id = toText(formData, "id");
  const apuId = toText(formData, "apu_id");
  const path = backTo(formData, apuId ? `/dashboard/apu/${apuId}` : "/dashboard/apu");
  if (!id || !apuId) {
    return fail(path, "No se pudo identificar el ítem.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("apu_items").delete().eq("id", id);

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath(`/dashboard/apu/${apuId}`);
  revalidatePath("/dashboard/apu");
  return ok(path, "Ítem APU eliminado.");
}

export async function agregarActividadPresupuestoProyectoAction(formData: FormData) {
  await requireActionAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado para gestionar presupuesto de obra."
  );

  const projectId = toText(formData, "project_id");
  const path = backTo(formData, projectId ? `/dashboard/proyectos-tecnicos/${projectId}/presupuesto` : "/dashboard/proyectos-tecnicos");
  const capitulo = toText(formData, "capitulo");
  const actividad = toText(formData, "actividad");
  const unidad = toText(formData, "unidad");

  if (!projectId || !capitulo || !actividad || !unidad) {
    return fail(path, "Proyecto, capítulo, actividad y unidad son obligatorios.");
  }

  const supabase = createAdminClient();
  const apuId = toText(formData, "apu_id");
  const cantidad = toNumber(toText(formData, "cantidad"), 0);
  const precioUnitario = toNumber(toText(formData, "precio_unitario"), 0);

  const { error } = await supabase.from("project_budget").insert({
    project_id: projectId,
    apu_id: apuId,
    capitulo,
    actividad,
    cantidad,
    unidad,
    precio_unitario: precioUnitario
  });

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}/presupuesto`);
  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}`);
  return ok(path, "Actividad agregada al presupuesto.");
}

export async function actualizarActividadPresupuestoProyectoAction(formData: FormData) {
  await requireActionAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado para editar presupuesto de obra."
  );

  const id = toText(formData, "id");
  const projectId = toText(formData, "project_id");
  const path = backTo(formData, projectId ? `/dashboard/proyectos-tecnicos/${projectId}/presupuesto` : "/dashboard/proyectos-tecnicos");

  if (!id || !projectId) {
    return fail(path, "No se pudo identificar la actividad presupuestada.");
  }

  const supabase = createAdminClient();
  const apuId = toText(formData, "apu_id");

  const { error } = await supabase
    .from("project_budget")
    .update({
      capitulo: toText(formData, "capitulo"),
      actividad: toText(formData, "actividad"),
      apu_id: apuId,
      cantidad: toNumber(toText(formData, "cantidad"), 0),
      unidad: toText(formData, "unidad"),
      precio_unitario: toNumber(toText(formData, "precio_unitario"), 0)
    })
    .eq("id", id);

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}/presupuesto`);
  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}`);
  return ok(path, "Actividad de presupuesto actualizada.");
}

export async function eliminarActividadPresupuestoProyectoAction(formData: FormData) {
  await requireActionAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado para eliminar actividades de presupuesto."
  );

  const id = toText(formData, "id");
  const projectId = toText(formData, "project_id");
  const path = backTo(formData, projectId ? `/dashboard/proyectos-tecnicos/${projectId}/presupuesto` : "/dashboard/proyectos-tecnicos");

  if (!id || !projectId) {
    return fail(path, "No se pudo identificar la actividad a eliminar.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("project_budget").delete().eq("id", id);

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}/presupuesto`);
  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}`);
  return ok(path, "Actividad eliminada del presupuesto.");
}
