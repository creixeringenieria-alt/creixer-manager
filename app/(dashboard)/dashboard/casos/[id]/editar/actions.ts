"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActionPermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_CASE_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_CASE_ATTACHMENT_SIZE_MB = MAX_CASE_ATTACHMENT_SIZE_BYTES / 1024 / 1024;

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function fail(caseId: string | null, message: string): never {
  const target = caseId ? `/dashboard/casos/${caseId}/editar` : "/dashboard/casos";
  redirect(`${target}?error=${encodeURIComponent(message)}`);
}

function normalizeValue(value: string | null, allowed: string[]) {
  if (!value) return null;
  return allowed.includes(value) ? value : null;
}

function getMissingColumnFromErrorMessage(message: string | undefined) {
  if (!message) return null;
  const match = message.match(/Could not find the '([^']+)' column/i);
  return match?.[1] ?? null;
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function validateCaseAttachment(file: File) {
  if (file.size > MAX_CASE_ATTACHMENT_SIZE_BYTES) {
    throw new Error(`El archivo "${file.name}" supera ${MAX_CASE_ATTACHMENT_SIZE_MB} MB. Reduce el tamaño o sube un archivo más liviano.`);
  }
}

function normalizeCaseDocumentType(value: string | null) {
  const allowed = [
    "convocatoria",
    "terminos_referencia",
    "anexos",
    "planos",
    "documento_cliente",
    "archivo_tecnico",
    "presupuesto",
    "contrato",
    "pliegos",
    "cronograma_contractual",
    "especificaciones",
    "polizas",
    "licencias",
    "evidencia_fotografica",
    "soporte_tecnico",
    "cotizacion_recibida",
    "otro"
  ];
  return value && allowed.includes(value) ? value : "otro";
}

async function uploadToEvidenceBucket(supabase: any, storagePath: string, file: File) {
  const uploadOptions = {
    upsert: false,
    contentType: file.type || "application/octet-stream"
  };

  const firstTry = await supabase.storage.from("evidences").upload(storagePath, file, uploadOptions);
  if (!firstTry.error) {
    return;
  }

  const message = String(firstTry.error.message ?? "");
  const bucketMissing = message.toLowerCase().includes("bucket") && message.toLowerCase().includes("not");
  if (!bucketMissing) {
    throw new Error(`Error subiendo archivo del caso: ${firstTry.error.message}`);
  }

  const created = await supabase.storage.createBucket("evidences", {
    public: true,
    fileSizeLimit: MAX_CASE_ATTACHMENT_SIZE_BYTES
  });

  if (created.error && !String(created.error.message ?? "").toLowerCase().includes("already")) {
    throw new Error(`No se pudo preparar el bucket de evidencias: ${created.error.message}`);
  }

  const secondTry = await supabase.storage.from("evidences").upload(storagePath, file, uploadOptions);
  if (secondTry.error) {
    throw new Error(`Error subiendo archivo del caso: ${secondTry.error.message}`);
  }
}

async function insertCaseDocument(supabase: any, payload: Record<string, unknown>) {
  for (let i = 0; i < 5; i += 1) {
    const response = await supabase.from("case_documents").insert(payload);
    if (!response.error) {
      return;
    }

    const missingColumn = getMissingColumnFromErrorMessage(response.error.message);
    if (missingColumn && missingColumn in payload) {
      delete payload[missingColumn];
      continue;
    }

    throw new Error(`Error registrando archivo del caso: ${response.error.message}`);
  }
}

export async function editarCasoAction(formData: FormData) {
  await requireActionPermission("editar_casos", "/dashboard/casos", "Acceso denegado para editar casos.");

  const caseId = textValue(formData, "case_id");
  const clientId = textValue(formData, "client_id");
  const flowType = normalizeValue(textValue(formData, "flow_type"), [
    "mantenimiento",
    "reparacion",
    "consultoria",
    "interventoria",
    "obra_conjunto_residencial"
  ]);
  const serviceArea = normalizeValue(textValue(formData, "service_area"), [
    "hidraulico",
    "electrico",
    "gasodomestico",
    "albanileria",
    "acabados",
    "mantenimiento_general"
  ]);
  const status = normalizeValue(textValue(formData, "status"), [
    "creado",
    "programado",
    "en_visita",
    "en_cotizacion",
    "autorizada",
    "cerrado",
    "cancelado"
  ]);
  const currentStage = normalizeValue(textValue(formData, "current_stage"), [
    "en_visita",
    "visitado",
    "pendiente_aprobacion",
    "aprobado",
    "en_reparacion",
    "finalizado",
    "cancelado"
  ]);

  if (!caseId) {
    return fail(null, "No se recibió el ID del caso.");
  }

  if (!clientId || !flowType || !serviceArea || !status || !currentStage) {
    return fail(caseId, "Cliente, tipo, requerimiento, estado y etapa son obligatorios.");
  }

  const priority = textValue(formData, "priority") ?? "media";
  const assignedToUserId = textValue(formData, "assigned_to_user_id");
  const internalClientCode = textValue(formData, "internal_client_code");
  const externalPropertyCode = textValue(formData, "external_property_code");
  const externalCaseId = textValue(formData, "external_case_id");
  const externalCaseCode = textValue(formData, "external_case_code");
  const description = textValue(formData, "description");
  const billToAssignedClient = (textValue(formData, "bill_to_assigned_client") ?? "si") === "si";
  const billingClientIdInput = textValue(formData, "billing_client_id");
  const billingObservations =
    textValue(formData, "billing_observations") ??
    (!billToAssignedClient && !billingClientIdInput
      ? "Cliente a facturar pendiente por definir después de aprobación."
      : null);

  const payload: Record<string, unknown> = {
    client_id: clientId,
    title: internalClientCode ?? `${flowType} - ${serviceArea}`,
    description,
    status,
    priority,
    flow_type: flowType,
    service_area: serviceArea,
    internal_client_code: internalClientCode,
    external_property_code: externalPropertyCode,
    external_case_id: externalCaseId,
    external_case_code: externalCaseCode,
    assigned_to_user_id: assignedToUserId,
    current_stage: currentStage,
    bill_to_assigned_client: billToAssignedClient,
    billing_client_id: billToAssignedClient ? clientId : billingClientIdInput ?? clientId,
    billing_observations: billingObservations,
    updated_at: new Date().toISOString()
  };

  const supabase = createAdminClient() as any;
  let lastError: string | null = null;

  for (let i = 0; i < 10; i += 1) {
    const response = await supabase.from("cases").update(payload).eq("id", caseId).select("id").single();
    if (!response.error) {
      revalidatePath("/dashboard/casos");
      revalidatePath(`/dashboard/casos/${caseId}`);
      revalidatePath(`/dashboard/casos/${caseId}/editar`);
      redirect(`/dashboard/casos/${caseId}?ok=${encodeURIComponent("Caso actualizado correctamente.")}`);
    }

    lastError = response.error.message;
    const missingColumn = getMissingColumnFromErrorMessage(response.error.message);
    if (missingColumn && missingColumn in payload) {
      delete payload[missingColumn];
      continue;
    }
    break;
  }

  return fail(caseId, lastError ?? "No se pudo actualizar el caso.");
}

export async function adjuntarDocumentosCasoAction(formData: FormData) {
  const ctx = await requireActionPermission("adjuntar_soportes", "/dashboard/casos", "Acceso denegado para adjuntar soportes.");

  const caseId = textValue(formData, "case_id");
  if (!caseId) {
    return fail(null, "No se recibió el ID del caso.");
  }

  const files = formData.getAll("case_files");
  const validFiles = files.filter((file): file is File => file instanceof File && file.size > 0);
  if (validFiles.length === 0) {
    return fail(caseId, "Selecciona al menos un archivo o foto para adjuntar.");
  }

  const supabase = createAdminClient() as any;
  const documentType = normalizeCaseDocumentType(textValue(formData, "case_document_type"));
  const customName = textValue(formData, "case_document_name");

  try {
    for (const file of validFiles) {
      validateCaseAttachment(file);
      const filename = sanitizeFilename(file.name || "documento");
      const storagePath = `cases/${caseId}/${Date.now()}-${filename}`;

      await uploadToEvidenceBucket(supabase, storagePath, file);

      const publicUrl = supabase.storage.from("evidences").getPublicUrl(storagePath).data.publicUrl;
      await insertCaseDocument(supabase, {
        case_id: caseId,
        document_type: documentType,
        name: customName ?? filename,
        original_filename: filename,
        storage_path: storagePath,
        file_url: publicUrl,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: ctx.userId
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron adjuntar los archivos.";
    console.error("[/dashboard/casos/[id]/editar] upload documents failed", { caseId, error: message });
    return fail(caseId, message);
  }

  revalidatePath("/dashboard/casos");
  revalidatePath(`/dashboard/casos/${caseId}`);
  revalidatePath(`/dashboard/casos/${caseId}/editar`);
  redirect(`/dashboard/casos/${caseId}/editar?ok=${encodeURIComponent("Soporte adjuntado correctamente.")}`);
}

export async function eliminarCasoAction(formData: FormData) {
  await requireActionPermission("editar_casos", "/dashboard/casos", "Acceso denegado para eliminar casos.");

  const caseId = textValue(formData, "case_id");
  if (!caseId) {
    return fail(null, "No se recibió el ID del caso.");
  }

  const supabase = createAdminClient() as any;
  const response = await supabase.from("cases").delete().eq("id", caseId);

  if (response.error) {
    console.error("[/dashboard/casos/[id]/editar] delete case failed", { caseId, error: response.error.message });
    return fail(caseId, `No se pudo eliminar el caso: ${response.error.message}`);
  }

  revalidatePath("/dashboard/casos");
  revalidatePath("/dashboard/casos/nuevo");
  redirect(`/dashboard/casos?ok=${encodeURIComponent("Caso eliminado correctamente.")}`);
}
