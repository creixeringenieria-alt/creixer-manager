"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActionPermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

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
