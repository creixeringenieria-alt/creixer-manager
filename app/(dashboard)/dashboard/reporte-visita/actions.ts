"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActionAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getBool(formData: FormData, key: string) {
  return getText(formData, key) === "si";
}

function fail(message: string) {
  redirect(`/dashboard/reporte-visita?error=${encodeURIComponent(message)}`);
}

function ok(message: string) {
  redirect(`/dashboard/reporte-visita?ok=${encodeURIComponent(message)}`);
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function crearReporteVisitaAction(formData: FormData) {
  const role = await requireActionAccess(
    ["administrador", "tecnico"],
    "/dashboard",
    "Acceso denegado: tu rol no puede registrar reportes de visita."
  );

  const agendaId = getText(formData, "agenda_id");
  const resultadoVisita = getText(formData, "resultado_visita");

  if (!agendaId || !resultadoVisita) {
    return fail("Agenda y resultado de visita son obligatorios.");
  }

  const supabase = createAdminClient();

  if (role === "tecnico") {
    const client = (await createClient()) as any;
    const {
      data: { user }
    } = await client.auth.getUser();

    if (!user) {
      return fail("Debes iniciar sesión para reportar visitas.");
    }

    const { data: agenda } = await supabase
      .from("agenda_operativa")
      .select("id, tecnico_id")
      .eq("id", agendaId)
      .maybeSingle();

    if (!agenda || agenda.tecnico_id !== user.id) {
      return fail("Acceso denegado: solo puedes reportar tus tareas asignadas.");
    }
  }

  const { data: reporte, error } = await supabase
    .from("reportes_visita")
    .insert({
      agenda_id: agendaId,
      hora_llegada: getText(formData, "hora_llegada"),
      hora_salida: getText(formData, "hora_salida"),
      resultado_visita: resultadoVisita,
      diagnostico_tecnico: getText(formData, "diagnostico_tecnico"),
      actividades_recomendadas: getText(formData, "actividades_recomendadas"),
      requiere_cotizacion: getBool(formData, "requiere_cotizacion"),
      se_reparo_en_sitio: getBool(formData, "se_reparo_en_sitio"),
      observaciones: getText(formData, "observaciones")
    })
    .select("id")
    .single();

  if (error || !reporte) {
    return fail(error?.message ?? "No se pudo registrar el reporte.");
  }

  const files = formData.getAll("fotos");

  for (const fileEntry of files) {
    if (!(fileEntry instanceof File) || fileEntry.size === 0) {
      continue;
    }

    const fileName = sanitizeFilename(fileEntry.name || "foto.jpg");
    const path = `reportes-visita/${agendaId}/${Date.now()}-${fileName}`;

    const { error: uploadError } = await supabase.storage.from("evidences").upload(path, fileEntry, {
      upsert: false,
      contentType: fileEntry.type || "image/jpeg"
    });

    if (uploadError) {
      return fail(`Reporte guardado, pero falló carga de foto: ${uploadError.message}`);
    }

    const { error: photoError } = await supabase.from("reporte_visita_fotos").insert({
      reporte_visita_id: reporte.id,
      storage_path: path,
      descripcion: "Evidencia de visita"
    });

    if (photoError) {
      return fail(`Reporte guardado, pero falló registro de foto: ${photoError.message}`);
    }
  }

  revalidatePath("/dashboard/reporte-visita");
  revalidatePath("/dashboard/agenda-operativa");
  revalidatePath("/dashboard/requerimientos");
  return ok("Reporte de visita registrado.");
}
