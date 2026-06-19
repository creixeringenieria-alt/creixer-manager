"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActionPermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function fail(message: string): never {
  redirect(`/dashboard/casos/nuevo?error=${encodeURIComponent(message)}`);
}

function normalizeFlowType(value: string | null) {
  if (!value) return null;
  const allowed = ["mantenimiento", "reparacion", "consultoria", "interventoria", "obra_conjunto_residencial"];
  return allowed.includes(value) ? value : null;
}

function normalizeServiceArea(value: string | null) {
  if (!value) return null;
  const allowed = ["hidraulico", "electrico", "gasodomestico", "albanileria", "acabados", "mantenimiento_general"];
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

async function guardarDocumentosCaso(caseId: string, formData: FormData, uploadedBy: string | null) {
  const files = formData.getAll("case_files");
  if (!files.length) return;

  const supabase = createAdminClient() as any;
  const documentType = textValue(formData, "case_document_type") ?? "otro";
  const customName = textValue(formData, "case_document_name");

  for (const fileEntry of files) {
    if (!(fileEntry instanceof File) || fileEntry.size === 0) continue;

    const filename = sanitizeFilename(fileEntry.name || "documento");
    const storagePath = `cases/${caseId}/${Date.now()}-${filename}`;

    const { error: uploadError } = await supabase.storage.from("evidences").upload(storagePath, fileEntry, {
      upsert: false,
      contentType: fileEntry.type || "application/octet-stream"
    });
    if (uploadError) {
      throw new Error(`Error subiendo archivo del caso: ${uploadError.message}`);
    }

    const publicUrl = supabase.storage.from("evidences").getPublicUrl(storagePath).data.publicUrl;
    const insertPayload: Record<string, unknown> = {
      case_id: caseId,
      document_type: documentType,
      name: customName ?? filename,
      original_filename: filename,
      storage_path: storagePath,
      file_url: publicUrl,
      mime_type: fileEntry.type || null,
      size_bytes: fileEntry.size,
      uploaded_by: uploadedBy
    };

    for (let i = 0; i < 4; i += 1) {
      const inserted = await supabase.from("case_documents").insert(insertPayload);
      if (!inserted.error) break;
      const missingColumn = getMissingColumnFromErrorMessage(inserted.error.message);
      if (missingColumn && missingColumn in insertPayload) {
        delete insertPayload[missingColumn];
        continue;
      }
      if (String(inserted.error.message ?? "").includes("relation") && String(inserted.error.message ?? "").includes("case_documents")) {
        // Si la tabla aún no existe en producción, no bloqueamos el alta del caso.
        return;
      }
      throw new Error(`Error registrando archivo del caso: ${inserted.error.message}`);
    }
  }
}

async function crearProyectoDesdeCaso(params: {
  caseId: string;
  clientId: string;
  flowType: string;
  serviceArea: string;
  internalClientCode: string | null;
  description: string | null;
  priority: string;
  userId: string | null;
  creationToken: string | null;
}) {
  const supabase = createAdminClient() as any;
  const nowIsoDate = new Date().toISOString().slice(0, 10);
  const name = params.internalClientCode ?? `CASO-${params.caseId.slice(0, 8).toUpperCase()}`;

  const baseType =
    params.flowType === "consultoria" || params.flowType === "interventoria" || params.flowType === "obra_conjunto_residencial"
      ? params.flowType
      : "mantenimiento";

  const payload: Record<string, unknown> = {
    case_id: params.caseId,
    client_id: params.clientId,
    type: baseType,
    name,
    internal_client_code: params.internalClientCode ?? name,
    description: params.description,
    request_category: params.serviceArea,
    status: "creado",
    start_date: nowIsoDate,
    planned_end_date: null,
    priority: params.priority,
    technical_lead_id: params.userId,
    director_responsible_id: params.userId,
    creation_token: params.creationToken
  };

  let projectId: string | null = null;
  for (let i = 0; i < 10; i += 1) {
    const inserted = await supabase.from("technical_projects").insert(payload).select("id").single();
    if (!inserted.error && inserted.data?.id) {
      projectId = inserted.data.id;
      break;
    }

    const message = String(inserted.error?.message ?? "");
    const missingColumn = getMissingColumnFromErrorMessage(inserted.error?.message);
    if (missingColumn && missingColumn in payload) {
      delete payload[missingColumn];
      continue;
    }
    if (message.includes('invalid input value for enum technical_project_type') && payload.type === "obra_conjunto_residencial") {
      payload.type = "mantenimiento";
      continue;
    }
    if (message.includes('invalid input value for enum technical_project_status') && payload.status === "creado") {
      payload.status = "planeado";
      continue;
    }
    if (message.includes('null value in column "planned_end_date"') && !payload.planned_end_date) {
      payload.planned_end_date = nowIsoDate;
      continue;
    }
    if (message.includes("duplicate key value violates unique constraint") && params.creationToken) {
      const existing = await supabase
        .from("technical_projects")
        .select("id")
        .eq("creation_token", params.creationToken)
        .maybeSingle();
      projectId = existing.data?.id ?? null;
    }
    break;
  }

  return projectId;
}

export async function crearCasoAction(formData: FormData) {
  await requireActionPermission("crear_casos", "/dashboard", "Acceso denegado para crear casos.");

  const clientId = textValue(formData, "client_id");
  const flowType = normalizeFlowType(textValue(formData, "flow_type"));
  const serviceArea = normalizeServiceArea(textValue(formData, "service_area"));
  const internalClientCode = textValue(formData, "internal_client_code");
  const externalPropertyCode = textValue(formData, "external_property_code");
  const externalCaseId = textValue(formData, "external_case_id");
  const externalCaseCode = textValue(formData, "external_case_code");
  const description = textValue(formData, "description");
  const priority = textValue(formData, "priority") ?? "media";
  const assignedToUserId = textValue(formData, "assigned_to_user_id");
  const billToAssignedClient = (textValue(formData, "bill_to_assigned_client") ?? "si") === "si";
  const billingClientIdInput = textValue(formData, "billing_client_id");
  const billingObservations = textValue(formData, "billing_observations");
  const creationToken = textValue(formData, "creation_token");

  if (!clientId || !flowType || !serviceArea) {
    return fail("Cliente, tipo de proyecto y especialidad son obligatorios.");
  }

  const supabase = createAdminClient() as any;
  const currentClient = (await createClient()) as any;
  const {
      data: { user }
  } = await currentClient.auth.getUser();
  const billingObservationsFinal =
    billingObservations ??
    (!billToAssignedClient && !billingClientIdInput
      ? "Cliente a facturar pendiente por definir después de aprobación."
      : null);

  const payload: Record<string, unknown> = {
    client_id: clientId,
    title: internalClientCode ?? `${flowType} - ${serviceArea}`,
    description,
    status: "creado",
    priority,
    flow_type: flowType,
    service_area: serviceArea,
    internal_client_code: internalClientCode,
    external_property_code: externalPropertyCode,
    external_case_id: externalCaseId,
    external_case_code: externalCaseCode,
    assigned_to_user_id: assignedToUserId,
    start_with_visit: true,
    current_stage: "en_visita",
    estimated_delivery_date: null,
    bill_to_assigned_client: billToAssignedClient,
    // Produccion todavia conserva un constraint que exige billing_client_id.
    // Si la facturacion queda "otro / por definir", usamos el cliente asignado
    // como referencia temporal y bill_to_assigned_client=false conserva la intencion operativa.
    billing_client_id: billToAssignedClient ? clientId : billingClientIdInput ?? clientId,
    billing_observations: billingObservationsFinal,
    created_by: user?.id ?? null,
    creation_token: creationToken
  };

  let response: { data: { id: string; case_code?: string | null } | null; error: { message?: string } | null } = {
    data: null,
    error: null
  };

  for (let i = 0; i < 10; i += 1) {
    const inserted = await supabase.from("cases").insert(payload).select("id, case_code").single();
    response = inserted;
    if (!inserted.error) {
      break;
    }

    const message = String(inserted.error.message ?? "");
    const missingColumn = getMissingColumnFromErrorMessage(inserted.error.message);
    if (missingColumn && missingColumn in payload) {
      delete payload[missingColumn];
      continue;
    }

    if (message.includes('invalid input value for enum') && payload.status === "creado") {
      payload.status = "pendiente";
      payload.current_stage = "en_visita";
      continue;
    }

    if (message.includes("duplicate key value violates unique constraint") && creationToken) {
      const existing = await supabase
        .from("cases")
        .select("id, case_code")
        .eq("creation_token", creationToken)
        .maybeSingle();
      if (existing.data?.id) {
        response = { data: existing.data, error: null };
      }
    }

    break;
  }

  if (response.error || !response.data) {
    return fail(response.error?.message ?? "No se pudo crear el caso.");
  }

  try {
    await guardarDocumentosCaso(response.data.id, formData, user?.id ?? null);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudieron guardar los archivos del caso.");
  }

  const caseCode = response.data.case_code ?? `CASO-${response.data.id.slice(0, 8).toUpperCase()}`;
  if (!externalCaseId) {
    await supabase
      .from("cases")
      .update({ external_case_id: caseCode })
      .eq("id", response.data.id);
  }
  revalidatePath("/dashboard/casos/nuevo");
  revalidatePath("/dashboard/casos");

  if (flowType === "mantenimiento" || flowType === "reparacion") {
    redirect(
      `/dashboard/casos?ok=${encodeURIComponent(
        `Caso ${caseCode} creado correctamente.`
      )}`
    );
  }

  const projectId = await crearProyectoDesdeCaso({
    caseId: response.data.id,
    clientId,
    flowType,
    serviceArea,
    internalClientCode,
    description,
    priority,
    userId: user?.id ?? null,
    creationToken
  });

  if (projectId) {
    revalidatePath("/dashboard/proyectos-tecnicos");
    revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}`);
    redirect(
      `/dashboard/proyectos-tecnicos/${projectId}?ok=${encodeURIComponent(
        `Caso ${caseCode} creado y enlazado al proyecto técnico.`
      )}`
    );
  }

  redirect(
    `/dashboard/proyectos-tecnicos?ok=${encodeURIComponent(
      `Caso ${caseCode} creado. Continúa con la creación del proyecto técnico.`
    )}`
  );
}
