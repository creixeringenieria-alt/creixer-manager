"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActionPermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function fail(message: string) {
  redirect(`/dashboard/agenda-operativa?error=${encodeURIComponent(message)}`);
}

function ok(message: string) {
  redirect(`/dashboard/agenda-operativa?ok=${encodeURIComponent(message)}`);
}

export async function crearAgendaOperativaAction(formData: FormData) {
  await requireActionPermission("asignar_tecnicos", "/dashboard", "Acceso denegado: tu rol no puede agendar visitas.");

  const requerimientoId = getText(formData, "requerimiento_id");
  const tecnicoId = getText(formData, "tecnico_id");
  const fechaProgramada = getText(formData, "fecha_programada");
  const franjaHoraria = getText(formData, "franja_horaria");
  const tipoVisita = getText(formData, "tipo_visita");
  const direccion = getText(formData, "direccion");

  if (!requerimientoId || !tecnicoId || !fechaProgramada || !franjaHoraria || !tipoVisita || !direccion) {
    return fail("Requerimiento, técnico, fecha, franja, tipo de visita y dirección son obligatorios.");
  }

  const supabase = createAdminClient();

  const { error } = await supabase.from("agenda_operativa").insert({
    requerimiento_id: requerimientoId,
    tecnico_id: tecnicoId,
    fecha_programada: fechaProgramada,
    franja_horaria: franjaHoraria,
    tipo_visita: tipoVisita,
    direccion,
    contacto: getText(formData, "contacto"),
    observaciones_logisticas: getText(formData, "observaciones_logisticas"),
    estado_agenda: getText(formData, "estado_agenda") ?? "programada"
  });

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/dashboard/agenda-operativa");
  revalidatePath("/dashboard/requerimientos");
  revalidatePath("/dashboard/reporte-visita");
  return ok("Agenda creada.");
}

export async function actualizarEstadoAgendaAction(formData: FormData) {
  await requireActionPermission("editar_casos", "/dashboard", "Acceso denegado: tu rol no puede cambiar estado de agenda.");

  const agendaId = getText(formData, "agenda_id");
  const estadoAgenda = getText(formData, "estado_agenda");

  if (!agendaId || !estadoAgenda) {
    return fail("No fue posible actualizar el estado de agenda.");
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("agenda_operativa")
    .update({ estado_agenda: estadoAgenda })
    .eq("id", agendaId);

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/dashboard/agenda-operativa");
  revalidatePath("/dashboard/requerimientos");
  return ok("Estado de agenda actualizado.");
}
