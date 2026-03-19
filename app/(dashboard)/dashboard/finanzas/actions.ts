"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActionAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

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

function backTo(formData: FormData, fallback: string) {
  return toText(formData, "return_path") ?? fallback;
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function ok(path: string, message: string): never {
  redirect(`${path}?ok=${encodeURIComponent(message)}`);
}

export async function actualizarFichaFinancieraAction(formData: FormData) {
  await requireActionAccess(["administrador", "contabilidad", "asistente"], "/dashboard", "Acceso denegado a ficha financiera.");

  const path = backTo(formData, "/dashboard/finanzas");
  const id = toText(formData, "id");
  if (!id) {
    return fail(path, "No se pudo identificar el registro financiero.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("financial_records")
    .update({
      valor_cotizado: toNumber(toText(formData, "valor_cotizado"), 0),
      valor_aprobado: toNumber(toText(formData, "valor_aprobado"), 0),
      requiere_anticipo: toText(formData, "requiere_anticipo") === "si",
      porcentaje_anticipo: toNumber(toText(formData, "porcentaje_anticipo"), 0),
      fecha_solicitud_anticipo: toText(formData, "fecha_solicitud_anticipo"),
      fecha_recepcion_anticipo: toText(formData, "fecha_recepcion_anticipo"),
      costo_total_asociado: toNumber(toText(formData, "costo_total_asociado"), 0),
      estado_financiero: toText(formData, "estado_financiero") ?? undefined
    })
    .eq("id", id);

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/finanzas");
  return ok(path, "Ficha financiera actualizada.");
}

export async function crearAnticipoAction(formData: FormData) {
  await requireActionAccess(["administrador", "contabilidad", "asistente"], "/dashboard", "Acceso denegado a anticipos.");

  const path = backTo(formData, "/dashboard/finanzas");
  const financialRecordId = toText(formData, "financial_record_id");
  if (!financialRecordId) {
    return fail(path, "No se pudo identificar el caso financiero.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("advance_requests").insert({
    financial_record_id: financialRecordId,
    requested_at: toText(formData, "requested_at"),
    percentage: toNumber(toText(formData, "percentage"), 0),
    amount_requested: toNumber(toText(formData, "amount_requested"), 0),
    amount_received: toNumber(toText(formData, "amount_received"), 0),
    received_at: toText(formData, "received_at"),
    status: toText(formData, "status") ?? "solicitado",
    notes: toText(formData, "notes")
  });

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/finanzas");
  return ok(path, "Anticipo registrado.");
}

export async function crearFacturaAction(formData: FormData) {
  await requireActionAccess(["administrador", "contabilidad"], "/dashboard", "Acceso denegado a facturación.");

  const path = backTo(formData, "/dashboard/finanzas");
  const financialRecordId = toText(formData, "financial_record_id");
  const invoiceNumber = toText(formData, "invoice_number");
  if (!financialRecordId || !invoiceNumber) {
    return fail(path, "Caso financiero y número de factura son obligatorios.");
  }

  const subtotal = toNumber(toText(formData, "amount_subtotal"), 0);
  const tax = toNumber(toText(formData, "amount_tax"), 0);
  const total = toNumber(toText(formData, "amount_total"), subtotal + tax);

  const supabase = createAdminClient();
  const { error } = await supabase.from("invoices").insert({
    financial_record_id: financialRecordId,
    invoice_number: invoiceNumber,
    dian_number: toText(formData, "dian_number"),
    issued_at: toText(formData, "issued_at"),
    due_at: toText(formData, "due_at"),
    amount_subtotal: subtotal,
    amount_tax: tax,
    amount_total: total,
    amount_pending: total,
    status: toText(formData, "status") ?? "emitida",
    pdf_url: toText(formData, "pdf_url"),
    xml_url: toText(formData, "xml_url"),
    notes: toText(formData, "notes")
  });

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/finanzas");
  return ok(path, "Factura creada.");
}

export async function registrarPagoFacturaAction(formData: FormData) {
  await requireActionAccess(["administrador", "contabilidad"], "/dashboard", "Acceso denegado a recaudos.");

  const path = backTo(formData, "/dashboard/finanzas");
  const invoiceId = toText(formData, "invoice_id");
  const amount = toNumber(toText(formData, "amount"), 0);
  if (!invoiceId || amount <= 0) {
    return fail(path, "Factura y valor de pago son obligatorios.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("invoice_payments").insert({
    invoice_id: invoiceId,
    paid_at: toText(formData, "paid_at"),
    amount,
    payment_method: toText(formData, "payment_method"),
    reference: toText(formData, "reference"),
    notes: toText(formData, "notes")
  });

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/finanzas");
  return ok(path, "Pago registrado.");
}

export async function crearNotaCreditoAction(formData: FormData) {
  await requireActionAccess(["administrador", "contabilidad"], "/dashboard", "Acceso denegado a notas crédito.");

  const path = backTo(formData, "/dashboard/finanzas");
  const invoiceId = toText(formData, "invoice_id");
  const noteNumber = toText(formData, "note_number");
  if (!invoiceId || !noteNumber) {
    return fail(path, "Factura y número de nota son obligatorios.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("credit_notes").insert({
    invoice_id: invoiceId,
    note_number: noteNumber,
    issued_at: toText(formData, "issued_at"),
    amount: toNumber(toText(formData, "amount"), 0),
    reason: toText(formData, "reason") ?? "Ajuste comercial"
  });

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/finanzas");
  return ok(path, "Nota crédito registrada.");
}
