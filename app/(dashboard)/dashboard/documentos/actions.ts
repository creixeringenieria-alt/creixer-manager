"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActionAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function toText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function ok(path: string, message: string): never {
  redirect(`${path}?ok=${encodeURIComponent(message)}`);
}

function generarCodigoOrden() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `OT-${yyyy}${mm}${dd}-${hh}${min}`;
}

function generarCodigoActa() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `AS-${yyyy}${mm}${dd}-${hh}${min}`;
}

async function getCurrentUserId() {
  const client = (await createClient()) as any;
  const {
    data: { user }
  } = await client.auth.getUser();
  return user?.id ?? null;
}

export async function crearOrdenTrabajoAction(formData: FormData) {
  await requireActionAccess(
    ["administrador", "asistente"],
    "/dashboard/ordenes-trabajo",
    "Acceso denegado: tu rol no puede crear órdenes de trabajo."
  );

  const returnPath = "/dashboard/ordenes-trabajo";
  const requerimientoId = toText(formData, "requerimiento_id");
  if (!requerimientoId) {
    return fail(returnPath, "Debes seleccionar un requerimiento.");
  }

  const supabase = createAdminClient();
  const createdBy = await getCurrentUserId();
  if (!createdBy) {
    return fail(returnPath, "No se pudo validar el usuario autenticado.");
  }
  const codigoOrden = toText(formData, "codigo_orden") ?? generarCodigoOrden();

  const { data, error } = await supabase
    .from("work_orders")
    .insert({
      request_id: null,
      requerimiento_id: requerimientoId,
      codigo_orden: codigoOrden,
      assigned_technician_id: toText(formData, "assigned_technician_id"),
      status: toText(formData, "status") ?? "programada",
      scheduled_start: toText(formData, "scheduled_start"),
      scheduled_end: toText(formData, "scheduled_end"),
      notes: toText(formData, "notes"),
      created_by: createdBy,
      fecha_documento: toText(formData, "fecha_documento"),
      direccion_servicio: toText(formData, "direccion_servicio"),
      contacto_nombre: toText(formData, "contacto_nombre"),
      contacto_telefono: toText(formData, "contacto_telefono"),
      alcance_trabajos: toText(formData, "alcance_trabajos"),
      recomendaciones: toText(formData, "recomendaciones"),
      firma_responsable_creixer: toText(formData, "firma_responsable_creixer")
    })
    .select("id")
    .single();

  if (error || !data) {
    return fail(returnPath, error?.message ?? "No se pudo crear la orden.");
  }

  revalidatePath("/dashboard/ordenes-trabajo");
  return ok(`/dashboard/ordenes-trabajo/${data.id}`, "Orden de trabajo creada.");
}

export async function crearActaSatisfaccionAction(formData: FormData) {
  await requireActionAccess(
    ["administrador", "asistente"],
    "/dashboard/actas-satisfaccion",
    "Acceso denegado: tu rol no puede crear actas de satisfacción."
  );

  const returnPath = "/dashboard/actas-satisfaccion";
  const requerimientoId = toText(formData, "requerimiento_id");
  const clienteId = toText(formData, "cliente_id");
  const servicioRealizado = toText(formData, "servicio_realizado");

  if (!requerimientoId || !clienteId || !servicioRealizado) {
    return fail(returnPath, "Requerimiento, cliente y servicio realizado son obligatorios.");
  }

  const supabase = createAdminClient();
  const createdBy = await getCurrentUserId();
  if (!createdBy) {
    return fail(returnPath, "No se pudo validar el usuario autenticado.");
  }
  const codigoActa = toText(formData, "codigo_acta") ?? generarCodigoActa();

  const { data, error } = await supabase
    .from("actas_satisfaccion")
    .insert({
      codigo_acta: codigoActa,
      requerimiento_id: requerimientoId,
      work_order_id: toText(formData, "work_order_id"),
      cliente_id: clienteId,
      inmueble_id: toText(formData, "inmueble_id"),
      fecha_acta: toText(formData, "fecha_acta"),
      servicio_realizado: servicioRealizado,
      resultado: toText(formData, "resultado"),
      satisfaccion: toText(formData, "satisfaccion") ?? "satisfecho",
      observaciones: toText(formData, "observaciones"),
      firmado_por_nombre: toText(formData, "firmado_por_nombre"),
      firmado_por_documento: toText(formData, "firmado_por_documento"),
      firmado_por_cargo: toText(formData, "firmado_por_cargo"),
      firma_responsable_creixer: toText(formData, "firma_responsable_creixer"),
      created_by: createdBy
    })
    .select("id")
    .single();

  if (error || !data) {
    return fail(returnPath, error?.message ?? "No se pudo crear el acta.");
  }

  revalidatePath("/dashboard/actas-satisfaccion");
  return ok(`/dashboard/actas-satisfaccion/${data.id}`, "Acta de satisfacción creada.");
}
