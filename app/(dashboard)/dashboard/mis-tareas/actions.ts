"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActionAccess } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

function toText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function fail(message: string): never {
  redirect(`/dashboard/mis-tareas?error=${encodeURIComponent(message)}`);
}

function ok(message: string): never {
  redirect(`/dashboard/mis-tareas?ok=${encodeURIComponent(message)}`);
}

async function getAgendaByRole(agendaId: string, role: "tecnico" | "administrador") {
  const supabase = (await createClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Debes iniciar sesión para ver tus tareas.");
  }

  let query = supabase.from("agenda_operativa").select("id, tecnico_id, requerimiento_id").eq("id", agendaId);
  if (role === "tecnico") {
    query = query.eq("tecnico_id", user.id);
  }
  const { data, error } = await query.single();

  if (error || !data) {
    throw new Error("No tienes permisos para modificar esta tarea.");
  }

  return { userId: user.id, agenda: data, supabase };
}

export async function marcarEstadoTareaAction(formData: FormData) {
  const role = await requireActionAccess(
    ["tecnico", "administrador"],
    "/dashboard",
    "Acceso denegado: este módulo es para técnicos o administrador."
  );

  const agendaId = toText(formData, "agenda_id");
  const estadoAgenda = toText(formData, "estado_agenda");

  if (!agendaId || !estadoAgenda) {
    return fail("No se pudo identificar la tarea.");
  }

  try {
    const { supabase } = await getAgendaByRole(agendaId, role as "tecnico" | "administrador");

    const { error } = await supabase
      .from("agenda_operativa")
      .update({ estado_agenda: estadoAgenda })
      .eq("id", agendaId);

    if (error) {
      return fail(error.message);
    }

    revalidatePath("/dashboard/mis-tareas");
    return ok("Estado actualizado.");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo actualizar la tarea.");
  }
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function subirFotoTareaAction(formData: FormData) {
  const role = await requireActionAccess(
    ["tecnico", "administrador"],
    "/dashboard",
    "Acceso denegado: este módulo es para técnicos o administrador."
  );

  const agendaId = toText(formData, "agenda_id");
  const descripcion = toText(formData, "descripcion");

  if (!agendaId) {
    return fail("No se pudo identificar la tarea para cargar foto.");
  }

  try {
    const { userId, agenda, supabase } = await getAgendaByRole(agendaId, role as "tecnico" | "administrador");
    const files = formData.getAll("fotos");

    for (const fileEntry of files) {
      if (!(fileEntry instanceof File) || fileEntry.size === 0) {
        continue;
      }

      const fileName = sanitizeFilename(fileEntry.name || "foto.jpg");
      const path = `mis-tareas/${agendaId}/${Date.now()}-${fileName}`;

      const { error: uploadError } = await supabase.storage.from("evidences").upload(path, fileEntry, {
        upsert: false,
        contentType: fileEntry.type || "image/jpeg"
      });

      if (uploadError) {
        return fail(uploadError.message);
      }

      const { error: insertError } = await supabase.from("photo_evidences").insert({
        request_id: agenda.requerimiento_id,
        uploaded_by: userId,
        storage_path: path,
        description: descripcion
      });

      if (insertError) {
        return fail(insertError.message);
      }
    }

    revalidatePath("/dashboard/mis-tareas");
    return ok("Foto(s) cargada(s) correctamente.");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudieron cargar las fotos.");
  }
}
