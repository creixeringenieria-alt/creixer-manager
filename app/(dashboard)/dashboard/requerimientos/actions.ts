"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActionAccess } from "@/lib/auth/permissions";
import { generarCodigoRequerimiento } from "@/lib/operaciones/constants";
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

function toNullableText(formData: FormData, key: string) {
  return getText(formData, key);
}

function fail(message: string) {
  redirect(`/dashboard/requerimientos?error=${encodeURIComponent(message)}`);
}

function ok(message: string) {
  redirect(`/dashboard/requerimientos?ok=${encodeURIComponent(message)}`);
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function getCurrentUserId() {
  const client = (await createClient()) as any;
  const {
    data: { user }
  } = await client.auth.getUser();
  return user?.id ?? null;
}

export async function crearRequerimientoAction(formData: FormData) {
  await requireActionAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede crear requerimientos."
  );

  const clienteId = getText(formData, "cliente_id");
  const inmuebleId = getText(formData, "inmueble_id");
  const descripcion = getText(formData, "descripcion");
  const tipoServicio = getText(formData, "tipo_servicio");

  if (!clienteId || !inmuebleId || !descripcion || !tipoServicio) {
    return fail("Cliente, inmueble, descripción y tipo de servicio son obligatorios.");
  }

  const codigo = getText(formData, "codigo_requerimiento") ?? generarCodigoRequerimiento();

  const supabase = createAdminClient();

  const { error } = await supabase.from("requerimientos").insert({
    codigo_requerimiento: codigo,
    cliente_id: clienteId,
    inmueble_id: inmuebleId,
    contacto_nombre: toNullableText(formData, "contacto_nombre"),
    contacto_telefono: toNullableText(formData, "contacto_telefono"),
    descripcion,
    canal_ingreso: getText(formData, "canal_ingreso") ?? "WhatsApp",
    tipo_servicio: tipoServicio,
    prioridad: getText(formData, "prioridad") ?? "media",
    estado: getText(formData, "estado") ?? "pendiente",
    fecha_reporte: getText(formData, "fecha_reporte"),
    observaciones_internas: toNullableText(formData, "observaciones_internas")
  });

  if (error) {
    return fail(error.message);
  }

  const createdId = await supabase
    .from("requerimientos")
    .select("id")
    .eq("codigo_requerimiento", codigo)
    .maybeSingle()
    .then((res) => res.data?.id ?? null);

  if (createdId) {
    const uploadedBy = await getCurrentUserId();
    const files = formData.getAll("documentos");
    const documentType = getText(formData, "document_type") ?? "archivo_tecnico";
    const nameOverride = getText(formData, "document_name");

    for (const fileEntry of files) {
      if (!(fileEntry instanceof File) || fileEntry.size === 0) {
        continue;
      }

      const filename = sanitizeFilename(fileEntry.name || "documento");
      const storagePath = `requerimientos/${createdId}/${Date.now()}-${filename}`;
      const { error: uploadError } = await supabase.storage.from("evidences").upload(storagePath, fileEntry, {
        upsert: false,
        contentType: fileEntry.type || "application/octet-stream"
      });

      if (uploadError) {
        return fail(`Requerimiento creado, pero falló carga de documento: ${uploadError.message}`);
      }

      const publicUrl = supabase.storage.from("evidences").getPublicUrl(storagePath).data.publicUrl;
      const { error: docError } = await supabase.from("requerimiento_documents").insert({
        requerimiento_id: createdId,
        document_type: documentType,
        name: nameOverride ?? filename,
        original_filename: filename,
        storage_path: storagePath,
        file_url: publicUrl,
        mime_type: fileEntry.type || null,
        size_bytes: fileEntry.size,
        uploaded_by: uploadedBy
      });

      if (docError) {
        return fail(`Requerimiento creado, pero falló registro de documento: ${docError.message}`);
      }
    }
  }

  revalidatePath("/dashboard/requerimientos");
  revalidatePath("/dashboard/agenda-operativa");
  return ok("Requerimiento creado.");
}
