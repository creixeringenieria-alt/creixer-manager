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

export async function crearCasoAction(formData: FormData) {
  await requireActionPermission("crear_casos", "/dashboard", "Acceso denegado para crear casos.");

  const clientId = textValue(formData, "client_id");
  const flowType = normalizeFlowType(textValue(formData, "flow_type"));
  const serviceArea = normalizeServiceArea(textValue(formData, "service_area"));
  const internalClientCode = textValue(formData, "internal_client_code");
  const description = textValue(formData, "description");
  const priority = textValue(formData, "priority") ?? "media";
  const estimatedDeliveryDate = textValue(formData, "estimated_delivery_date");

  if (!clientId || !flowType || !serviceArea) {
    return fail("Cliente, tipo de proyecto y especialidad son obligatorios.");
  }

  const supabase = createAdminClient() as any;
  const currentClient = (await createClient()) as any;
  const {
    data: { user }
  } = await currentClient.auth.getUser();

  const payload: Record<string, unknown> = {
    client_id: clientId,
    title: internalClientCode ?? `${flowType} - ${serviceArea}`,
    description,
    status: "en_visita",
    priority,
    flow_type: flowType,
    service_area: serviceArea,
    internal_client_code: internalClientCode,
    start_with_visit: true,
    current_stage: "en_visita",
    estimated_delivery_date: estimatedDeliveryDate,
    created_by: user?.id ?? null
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

    if (message.includes('invalid input value for enum') && payload.status === "en_visita") {
      payload.status = "pendiente";
      payload.current_stage = "pendiente";
      continue;
    }

    break;
  }

  if (response.error || !response.data) {
    return fail(response.error?.message ?? "No se pudo crear el caso.");
  }

  const caseCode = response.data.case_code ?? `CASO-${response.data.id.slice(0, 8).toUpperCase()}`;
  revalidatePath("/dashboard/casos/nuevo");
  revalidatePath("/dashboard/casos");

  if (flowType === "mantenimiento" || flowType === "reparacion") {
    redirect(
      `/dashboard/requerimientos?ok=${encodeURIComponent(
        `Caso ${caseCode} creado. Continúa con el requerimiento y agenda de visita.`
      )}`
    );
  }

  redirect(
    `/dashboard/proyectos-tecnicos?ok=${encodeURIComponent(
      `Caso ${caseCode} creado. Continúa con la creación del proyecto técnico.`
    )}`
  );
}
