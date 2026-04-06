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

function toNumber(value: string | null, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function addDays(baseDate: string, days: number) {
  const date = new Date(`${baseDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
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

async function getCurrentUserId() {
  const client = (await createClient()) as any;
  const {
    data: { user }
  } = await client.auth.getUser();
  return user?.id ?? null;
}

async function guardarDocumentosIniciales(projectId: string, formData: FormData) {
  const files = formData.getAll("project_files");
  if (!files.length) {
    return;
  }

  const supabase = createAdminClient();
  const uploadedBy = await getCurrentUserId();
  const documentType = toText(formData, "project_document_type") ?? "otro";
  const customName = toText(formData, "project_document_name");

  for (const fileEntry of files) {
    if (!(fileEntry instanceof File) || fileEntry.size === 0) {
      continue;
    }

    const filename = sanitizeFilename(fileEntry.name || "documento");
    const storagePath = `proyectos-tecnicos/${projectId}/${Date.now()}-${filename}`;

    const { error: uploadError } = await supabase.storage.from("evidences").upload(storagePath, fileEntry, {
      upsert: false,
      contentType: fileEntry.type || "application/octet-stream"
    });

    if (uploadError) {
      throw new Error(`Error subiendo documento: ${uploadError.message}`);
    }

    const publicUrl = supabase.storage.from("evidences").getPublicUrl(storagePath).data.publicUrl;
    const { error: insertError } = await supabase.from("technical_project_documents").insert({
      project_id: projectId,
      document_type: documentType,
      name: customName ?? filename,
      original_filename: filename,
      storage_path: storagePath,
      file_url: publicUrl,
      mime_type: fileEntry.type || null,
      size_bytes: fileEntry.size,
      uploaded_by: uploadedBy
    });

    if (insertError) {
      throw new Error(`Error registrando documento: ${insertError.message}`);
    }
  }
}

async function generarTareasBase(projectId: string, projectType: string, startDate: string, responsibleId: string | null) {
  const supabase = createAdminClient();

  const commonTasks = [
    { task_type: "visita_tecnica", name: "Visita técnica", offset: 1, priority: "alta" },
    { task_type: "levantamiento_cantidades", name: "Levantamiento de cantidades", offset: 2, priority: "alta" },
    { task_type: "revision_documental", name: "Revisión documental", offset: 3, priority: "media" },
    { task_type: "informe_tecnico", name: "Informe técnico", offset: 5, priority: "alta" },
    { task_type: "envio_cotizacion", name: "Envío de cotización", offset: 7, priority: "media" },
    { task_type: "seguimiento", name: "Seguimiento", offset: 10, priority: "media" },
    { task_type: "entrega_final", name: "Entrega final", offset: 14, priority: "alta" }
  ];

  const extraInterventoria =
    projectType === "interventoria"
      ? [
          { task_type: "revision_documental", name: "Seguimiento a contratista", offset: 4, priority: "alta" },
          { task_type: "revision_documental", name: "Control de no conformidades", offset: 8, priority: "alta" }
        ]
      : [];

  const payload = [...commonTasks, ...extraInterventoria].map((task) => ({
    project_id: projectId,
    task_type: task.task_type,
    name: task.name,
    responsible_user_id: responsibleId,
    status: "pendiente",
    priority: task.priority,
    progress_percent: 0,
    start_date: startDate,
    planned_end_date: addDays(startDate, task.offset),
    alert_enabled: true
  }));

  const { error } = await supabase.from("technical_project_tasks").insert(payload);
  if (error) {
    throw new Error(`Error creando tareas base: ${error.message}`);
  }
}

export async function crearProyectoTecnicoAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al crear proyectos técnicos.");

  const path = backTo(formData, "/dashboard/proyectos-tecnicos");
  const clientId = toText(formData, "client_id");
  const type = toText(formData, "type");
  const name = toText(formData, "name");
  const startDate = toText(formData, "start_date");
  const plannedEndDate = toText(formData, "estimated_end_date") ?? toText(formData, "planned_end_date");

  if (!clientId || !type || !name || !startDate) {
    return fail(path, "Cliente, tipo, código interno y fecha inicio son obligatorios.");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("technical_projects")
    .insert({
      client_id: clientId,
      type,
      name,
      internal_client_code: name,
      description: toText(formData, "description"),
      location: toText(formData, "location"),
      linked_request_id: toText(formData, "linked_request_id"),
      request_category: toText(formData, "request_category"),
      status: toText(formData, "status") ?? "en_visita",
      start_date: startDate,
      planned_end_date: plannedEndDate,
      priority: toText(formData, "priority") ?? "media",
      director_responsible_id: toText(formData, "director_responsible_id"),
      technical_lead_id: toText(formData, "technical_lead_id")
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.message?.includes("no unique or exclusion constraint matching the ON CONFLICT specification")) {
      return fail(
        path,
        "Falta aplicar la migración financiera nueva en Supabase (trigger ON CONFLICT). Ejecuta: supabase db push."
      );
    }
    return fail(path, error?.message ?? "No se pudo crear el proyecto.");
  }

  try {
    await guardarDocumentosIniciales(data.id, formData);
    if (toText(formData, "generar_tareas_base") === "si") {
      await generarTareasBase(data.id, type, startDate, toText(formData, "technical_lead_id"));
    }
  } catch (err) {
    return fail(path, err instanceof Error ? err.message : "No se pudo completar la configuración inicial.");
  }

  revalidatePath("/dashboard/proyectos-tecnicos");
  revalidatePath(`/dashboard/proyectos-tecnicos/${data.id}`);
  return ok(`/dashboard/proyectos-tecnicos/${data.id}`, "Proyecto técnico creado.");
}

export async function actualizarProyectoTecnicoAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al actualizar proyectos.");

  const path = backTo(formData, "/dashboard/proyectos-tecnicos");
  const id = toText(formData, "id");

  if (!id) {
    return fail(path, "No se pudo identificar el proyecto.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("technical_projects")
    .update({
      name: toText(formData, "name"),
      description: toText(formData, "description"),
      location: toText(formData, "location"),
      status: toText(formData, "status"),
      start_date: toText(formData, "start_date"),
      planned_end_date: toText(formData, "planned_end_date"),
      actual_end_date: toText(formData, "actual_end_date"),
      priority: toText(formData, "priority"),
      director_responsible_id: toText(formData, "director_responsible_id"),
      technical_lead_id: toText(formData, "technical_lead_id")
    })
    .eq("id", id);

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/proyectos-tecnicos");
  revalidatePath(`/dashboard/proyectos-tecnicos/${id}`);
  return ok(path, "Proyecto actualizado.");
}

export async function crearFaseProyectoAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al crear fases.");

  const path = backTo(formData, "/dashboard/proyectos-tecnicos");
  const projectId = toText(formData, "project_id");
  const name = toText(formData, "name");

  if (!projectId || !name) {
    return fail(path, "Proyecto y nombre de fase son obligatorios.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("technical_project_phases").insert({
    project_id: projectId,
    name,
    phase_order: toNumber(toText(formData, "phase_order"), 1),
    status: toText(formData, "status") ?? "pendiente",
    start_date: toText(formData, "start_date"),
    planned_end_date: toText(formData, "planned_end_date")
  });

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}`);
  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}/gantt`);
  return ok(path, "Fase creada.");
}

export async function crearTareaProyectoAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al crear tareas.");

  const path = backTo(formData, "/dashboard/proyectos-tecnicos");
  const projectId = toText(formData, "project_id");
  const name = toText(formData, "name");

  if (!projectId || !name) {
    return fail(path, "Proyecto y nombre de tarea son obligatorios.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("technical_project_tasks").insert({
    project_id: projectId,
    task_type: toText(formData, "task_type") ?? "otro",
    phase_id: toText(formData, "phase_id"),
    parent_task_id: toText(formData, "parent_task_id"),
    name,
    description: toText(formData, "description"),
    responsible_user_id: toText(formData, "responsible_user_id"),
    status: toText(formData, "status") ?? "pendiente",
    priority: toText(formData, "priority") ?? "media",
    progress_percent: toNumber(toText(formData, "progress_percent"), 0),
    start_date: toText(formData, "start_date"),
    scheduled_time: toText(formData, "scheduled_time"),
    planned_end_date: toText(formData, "planned_end_date"),
    depends_on_task_id: toText(formData, "depends_on_task_id"),
    alert_enabled: toText(formData, "alert_enabled") === "si",
    notes: toText(formData, "notes")
  });

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}`);
  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}/gantt`);
  return ok(path, "Tarea creada.");
}

export async function actualizarTareaProyectoAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al actualizar tareas.");

  const path = backTo(formData, "/dashboard/proyectos-tecnicos");
  const id = toText(formData, "id");
  const projectId = toText(formData, "project_id");

  if (!id || !projectId) {
    return fail(path, "No se pudo identificar la tarea.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("technical_project_tasks")
    .update({
      task_type: toText(formData, "task_type"),
      status: toText(formData, "status"),
      priority: toText(formData, "priority"),
      progress_percent: toNumber(toText(formData, "progress_percent"), 0),
      responsible_user_id: toText(formData, "responsible_user_id"),
      start_date: toText(formData, "start_date"),
      scheduled_time: toText(formData, "scheduled_time"),
      planned_end_date: toText(formData, "planned_end_date"),
      actual_end_date: toText(formData, "actual_end_date"),
      notes: toText(formData, "notes"),
      alert_enabled: toText(formData, "alert_enabled") === "si"
    })
    .eq("id", id);

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}`);
  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}/gantt`);
  return ok(path, "Tarea actualizada.");
}

export async function crearEntregableProyectoAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al crear entregables.");

  const path = backTo(formData, "/dashboard/proyectos-tecnicos");
  const projectId = toText(formData, "project_id");
  const deliverableType = toText(formData, "deliverable_type");
  const name = toText(formData, "name");

  if (!projectId || !deliverableType || !name) {
    return fail(path, "Proyecto, tipo y nombre del entregable son obligatorios.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("technical_project_deliverables").insert({
    project_id: projectId,
    task_id: toText(formData, "task_id"),
    deliverable_type: deliverableType,
    name,
    version: toText(formData, "version") ?? "1.0",
    status: toText(formData, "status") ?? "pendiente",
    responsible_user_id: toText(formData, "responsible_user_id"),
    planned_delivery_date: toText(formData, "planned_delivery_date"),
    actual_delivery_date: toText(formData, "actual_delivery_date"),
    file_url: toText(formData, "file_url"),
    notes: toText(formData, "notes")
  });

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}/entregables`);
  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}`);
  return ok(path, "Entregable registrado.");
}

export async function crearSeguimientoProyectoAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al crear seguimientos.");

  const path = backTo(formData, "/dashboard/proyectos-tecnicos");
  const projectId = toText(formData, "project_id");
  const followupType = toText(formData, "followup_type");
  const summary = toText(formData, "summary");

  if (!projectId || !followupType || !summary) {
    return fail(path, "Proyecto, tipo y resumen del seguimiento son obligatorios.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("technical_project_followups").insert({
    project_id: projectId,
    followup_type: followupType,
    date: toText(formData, "date"),
    responsible_user_id: toText(formData, "responsible_user_id"),
    summary,
    commitments: toText(formData, "commitments"),
    next_followup_date: toText(formData, "next_followup_date"),
    alert_enabled: toText(formData, "alert_enabled") === "si"
  });

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}/seguimientos`);
  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}`);
  return ok(path, "Seguimiento registrado.");
}

export async function crearCantidadProyectoAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al registrar cantidades.");

  const path = backTo(formData, "/dashboard/proyectos-tecnicos");
  const projectId = toText(formData, "project_id");
  const quantityType = toText(formData, "quantity_type");
  const itemName = toText(formData, "item_name");

  if (!projectId || !quantityType || !itemName) {
    return fail(path, "Proyecto, tipo e ítem son obligatorios.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("technical_project_quantities").insert({
    project_id: projectId,
    task_id: toText(formData, "task_id"),
    quantity_type: quantityType,
    item_name: itemName,
    value: toNumber(toText(formData, "value"), 0),
    unit: toText(formData, "unit") ?? "und",
    notes: toText(formData, "notes")
  });

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}/cantidades`);
  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}`);
  return ok(path, "Cantidad registrada.");
}

export async function crearRegistroInterventoriaAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al registrar interventoría.");

  const path = backTo(formData, "/dashboard/proyectos-tecnicos");
  const projectId = toText(formData, "project_id");
  const recordType = toText(formData, "record_type");
  const title = toText(formData, "title");

  if (!projectId || !recordType || !title) {
    return fail(path, "Proyecto, tipo y título son obligatorios.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("interventoria_records").insert({
    project_id: projectId,
    record_type: recordType,
    title,
    description: toText(formData, "description"),
    status: toText(formData, "status") ?? "pendiente",
    responsible_user_id: toText(formData, "responsible_user_id"),
    due_date: toText(formData, "due_date")
  });

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}/interventoria`);
  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}`);
  return ok(path, "Registro de interventoría creado.");
}

export async function marcarAlertaLeidaAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al gestionar alertas.");

  const path = backTo(formData, "/dashboard/proyectos-tecnicos");
  const id = toText(formData, "id");

  if (!id) {
    return fail(path, "No se pudo identificar la alerta.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("project_alerts").update({ is_read: true }).eq("id", id);

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/proyectos-tecnicos");
  return ok(path, "Alerta marcada como leída.");
}

export async function subirDocumentoProyectoAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al cargar documentos.");

  const projectId = toText(formData, "project_id");
  const path = backTo(formData, "/dashboard/proyectos-tecnicos");

  if (!projectId) {
    return fail(path, "No se pudo identificar el proyecto.");
  }

  try {
    await guardarDocumentosIniciales(projectId, formData);
  } catch (err) {
    return fail(path, err instanceof Error ? err.message : "No se pudieron cargar documentos.");
  }

  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}`);
  return ok(path, "Documento(s) cargado(s).");
}

export async function guardarContratoInterventoriaAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado a contrato de interventoría.");

  const path = backTo(formData, "/dashboard/proyectos-tecnicos");
  const projectId = toText(formData, "project_id");
  if (!projectId) {
    return fail(path, "No se pudo identificar el proyecto.");
  }

  const supabase = createAdminClient();
  const payload = {
    project_id: projectId,
    contractor_name: toText(formData, "contractor_name"),
    contract_object: toText(formData, "contract_object"),
    location: toText(formData, "location"),
    contract_term_days: toNumber(toText(formData, "contract_term_days"), 0) || null,
    contract_start_date: toText(formData, "contract_start_date"),
    contract_end_date: toText(formData, "contract_end_date"),
    contract_value: toNumber(toText(formData, "contract_value"), 0),
    interventoria_responsible_id: toText(formData, "interventoria_responsible_id"),
    status: toText(formData, "status") ?? "planeado"
  };

  const { error } = await supabase.from("interventoria_contracts").upsert(payload, { onConflict: "project_id" });
  if (error) {
    return fail(path, error.message);
  }
  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}/interventoria`);
  return ok(path, "Datos contractuales actualizados.");
}

export async function crearVisitaInterventoriaAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado a visitas de interventoría.");

  const path = backTo(formData, "/dashboard/proyectos-tecnicos");
  const projectId = toText(formData, "project_id");
  if (!projectId) return fail(path, "Proyecto requerido.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("interventoria_site_visits").insert({
    project_id: projectId,
    visit_date: toText(formData, "visit_date"),
    responsible_user_id: toText(formData, "responsible_user_id"),
    observed_activities: toText(formData, "observed_activities"),
    progress_percent: toNumber(toText(formData, "progress_percent"), 0),
    observations: toText(formData, "observations"),
    commitments: toText(formData, "commitments")
  });
  if (error) return fail(path, error.message);
  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}/interventoria`);
  return ok(path, "Visita registrada.");
}

export async function crearAvanceFisicoInterventoriaAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado a avance físico.");
  const path = backTo(formData, "/dashboard/proyectos-tecnicos");
  const projectId = toText(formData, "project_id");
  if (!projectId) return fail(path, "Proyecto requerido.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("interventoria_physical_progress").insert({
    project_id: projectId,
    task_id: toText(formData, "task_id"),
    activity_name: toText(formData, "activity_name"),
    unit: toText(formData, "unit") ?? "und",
    quantity_programmed: toNumber(toText(formData, "quantity_programmed"), 0),
    quantity_executed: toNumber(toText(formData, "quantity_executed"), 0),
    progress_percent: toNumber(toText(formData, "progress_percent"), 0),
    notes: toText(formData, "notes")
  });
  if (error) return fail(path, error.message);
  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}/interventoria`);
  return ok(path, "Avance físico registrado.");
}

export async function crearAvanceFinancieroInterventoriaAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado a avance financiero.");
  const path = backTo(formData, "/dashboard/proyectos-tecnicos");
  const projectId = toText(formData, "project_id");
  if (!projectId) return fail(path, "Proyecto requerido.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("interventoria_financial_progress").insert({
    project_id: projectId,
    task_id: toText(formData, "task_id"),
    activity_name: toText(formData, "activity_name"),
    value_programmed: toNumber(toText(formData, "value_programmed"), 0),
    value_executed: toNumber(toText(formData, "value_executed"), 0),
    value_pending: toNumber(toText(formData, "value_pending"), 0),
    notes: toText(formData, "notes")
  });
  if (error) return fail(path, error.message);
  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}/interventoria`);
  return ok(path, "Avance financiero registrado.");
}

export async function crearCalidadInterventoriaAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado a calidad.");
  const path = backTo(formData, "/dashboard/proyectos-tecnicos");
  const projectId = toText(formData, "project_id");
  if (!projectId) return fail(path, "Proyecto requerido.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("interventoria_quality_records").insert({
    project_id: projectId,
    inspection_type: toText(formData, "inspection_type"),
    test_reference: toText(formData, "test_reference"),
    status: toText(formData, "status") ?? "conforme",
    observations: toText(formData, "observations"),
    corrective_actions: toText(formData, "corrective_actions"),
    close_date: toText(formData, "close_date")
  });
  if (error) return fail(path, error.message);
  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}/interventoria`);
  return ok(path, "Registro de calidad creado.");
}

export async function crearSstInterventoriaAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado a SST.");
  const path = backTo(formData, "/dashboard/proyectos-tecnicos");
  const projectId = toText(formData, "project_id");
  if (!projectId) return fail(path, "Proyecto requerido.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("interventoria_sst_records").insert({
    project_id: projectId,
    observation: toText(formData, "observation"),
    non_compliance: toText(formData, "non_compliance"),
    corrective_action: toText(formData, "corrective_action"),
    status: toText(formData, "status") ?? "abierta",
    close_date: toText(formData, "close_date")
  });
  if (error) return fail(path, error.message);
  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}/interventoria`);
  return ok(path, "Registro SST creado.");
}

export async function crearActaInterventoriaAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado a actas.");
  const path = backTo(formData, "/dashboard/proyectos-tecnicos");
  const projectId = toText(formData, "project_id");
  if (!projectId) return fail(path, "Proyecto requerido.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("interventoria_actas").insert({
    project_id: projectId,
    acta_type: toText(formData, "acta_type") ?? "comite",
    title: toText(formData, "title"),
    meeting_date: toText(formData, "meeting_date"),
    summary: toText(formData, "summary"),
    commitments: toText(formData, "commitments"),
    file_url: toText(formData, "file_url")
  });
  if (error) return fail(path, error.message);
  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}/interventoria`);
  return ok(path, "Acta registrada.");
}

export async function crearRequerimientoContratistaAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado a requerimientos de contratista.");
  const path = backTo(formData, "/dashboard/proyectos-tecnicos");
  const projectId = toText(formData, "project_id");
  if (!projectId) return fail(path, "Proyecto requerido.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("interventoria_contractor_requirements").insert({
    project_id: projectId,
    description: toText(formData, "description"),
    request_date: toText(formData, "request_date"),
    responsible_user_id: toText(formData, "responsible_user_id"),
    due_date: toText(formData, "due_date"),
    status: toText(formData, "status") ?? "abierto",
    support_url: toText(formData, "support_url"),
    close_notes: toText(formData, "close_notes"),
    close_date: toText(formData, "close_date")
  });
  if (error) return fail(path, error.message);
  revalidatePath(`/dashboard/proyectos-tecnicos/${projectId}/interventoria`);
  return ok(path, "Requerimiento al contratista registrado.");
}
