"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canAdministrarEstadoCotizacion, requireActionAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

type SectionMap = Record<string, string>;

interface CotizacionItemPayload {
  item: number;
  actividadId?: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  vrUnitario: number;
}

interface SelectedFotoPayload {
  storage_path: string;
  descripcion?: string;
  orden?: number;
  origen?: "manual" | "reporte_visita";
  reporte_visita_foto_id?: string | null;
}

function toText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toBool(formData: FormData, key: string) {
  return toText(formData, key) === "si";
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJson<T>(raw: FormDataEntryValue | null, fallback: T): T {
  if (typeof raw !== "string") {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function ok(path: string, message: string): never {
  redirect(`${path}?ok=${encodeURIComponent(message)}`);
}

function generarCodigoCotizacion() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `COT-${yyyy}${mm}${dd}-${hh}${min}`;
}

function normalizeItems(items: CotizacionItemPayload[]) {
  return items
    .map((item, index) => {
      const cantidad = toNumber(item.cantidad);
      const vrUnitario = toNumber(item.vrUnitario);
      const descripcion = (item.descripcion ?? "").trim();
      const unidad = (item.unidad ?? "").trim();

      return {
        item_numero: index + 1,
        actividad_id: (item.actividadId ?? "").trim() || null,
        descripcion,
        cantidad,
        unidad,
        valor_unitario: vrUnitario,
        valor_total: cantidad * vrUnitario,
        orden: index + 1
      };
    })
    .filter((item) => item.descripcion.length > 0);
}

function normalizeSelectedFotos(input: SelectedFotoPayload[]) {
  return input
    .map((foto, index) => ({
      storage_path: (foto.storage_path ?? "").trim(),
      caption: (foto.descripcion ?? "").trim() || null,
      orden: Number.isFinite(Number(foto.orden)) && Number(foto.orden) > 0 ? Number(foto.orden) : index + 1,
      origen: foto.origen === "reporte_visita" ? "reporte_visita" : "manual",
      reporte_visita_foto_id: foto.reporte_visita_foto_id ?? null
    }))
    .filter((foto) => foto.storage_path.length > 0)
    .sort((a, b) => a.orden - b.orden);
}

interface TotalsInput {
  pctAdministracion: number;
  pctImprevisto: number;
  pctUtilidad: number;
  pctIvaUtilidad: number;
  aplicaIva: boolean;
}

function calcularTotales(items: ReturnType<typeof normalizeItems>, input: TotalsInput) {
  const subtotal = items.reduce((sum, item) => sum + item.valor_total, 0);
  const valorAdministracion = subtotal * (input.pctAdministracion / 100);
  const valorImprevisto = subtotal * (input.pctImprevisto / 100);
  const valorUtilidad = subtotal * (input.pctUtilidad / 100);
  const totalSinIva = subtotal + valorAdministracion + valorImprevisto + valorUtilidad;
  const valorIva = input.aplicaIva ? valorUtilidad * (input.pctIvaUtilidad / 100) : 0;
  const totalFinal = totalSinIva + valorIva;

  return {
    subtotal,
    valorAdministracion,
    valorImprevisto,
    valorUtilidad,
    totalSinIva,
    valorIva,
    totalFinal
  };
}

async function upsertSecciones(cotizacionId: string, secciones: SectionMap) {
  const supabase = createAdminClient();

  const orderMap = [
    "introduccion",
    "objetivo_general",
    "objetivos_especificos",
    "diagnostico_preliminar",
    "alcance",
    "garantia",
    "tiempo_ejecucion",
    "notas_importantes",
    "forma_pago",
    "firma_final"
  ] as const;

  const payload = orderMap
    .map((tipo, index) => ({
      cotizacion_id: cotizacionId,
      tipo_seccion: tipo,
      titulo: tipo.replaceAll("_", " "),
      contenido: (secciones[tipo] ?? "").trim(),
      orden: index + 1
    }))
    .filter((item) => item.contenido.length > 0);

  await supabase.from("cotizacion_secciones").delete().eq("cotizacion_id", cotizacionId);

  if (payload.length > 0) {
    const { error } = await supabase.from("cotizacion_secciones").insert(payload);

    if (error) {
      throw new Error(error.message);
    }
  }
}

async function upsertItems(cotizacionId: string, items: ReturnType<typeof normalizeItems>) {
  const supabase = createAdminClient();

  await supabase.from("cotizacion_items").delete().eq("cotizacion_id", cotizacionId);

  if (items.length > 0) {
    const payload = items.map((item) => ({ ...item, cotizacion_id: cotizacionId }));

    const { error } = await supabase.from("cotizacion_items").insert(payload);

    if (error) {
      throw new Error(error.message);
    }
  }
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function upsertFotosCotizacion(cotizacionId: string, selectedFotos: SelectedFotoPayload[], formData: FormData) {
  const supabase = createAdminClient();

  const normalized = normalizeSelectedFotos(selectedFotos);

  await supabase.from("cotizacion_fotos").delete().eq("cotizacion_id", cotizacionId);

  if (normalized.length > 0) {
    const payload = normalized.map((foto) => ({
      cotizacion_id: cotizacionId,
      storage_path: foto.storage_path,
      caption: foto.caption,
      orden: foto.orden,
      origen: foto.origen,
      reporte_visita_foto_id: foto.reporte_visita_foto_id
    }));

    const { error } = await supabase.from("cotizacion_fotos").insert(payload);

    if (error) {
      throw new Error(error.message);
    }
  }

  const files = formData.getAll("fotos_manuales");
  const caption = toText(formData, "fotos_manuales_caption");
  let orden = toNumber(toText(formData, "fotos_manuales_orden_inicial"), 0);
  if (orden <= 0) {
    orden = normalized.length > 0 ? Math.max(...normalized.map((item) => item.orden)) + 1 : 1;
  }

  for (const fileEntry of files) {
    if (!(fileEntry instanceof File) || fileEntry.size === 0) {
      continue;
    }

    const fileName = sanitizeFilename(fileEntry.name || "foto.jpg");
    const path = `cotizaciones/${cotizacionId}/${Date.now()}-${fileName}`;

    const { error: uploadError } = await supabase.storage.from("evidences").upload(path, fileEntry, {
      upsert: false,
      contentType: fileEntry.type || "image/jpeg"
    });

    if (uploadError) {
      throw new Error(`Error subiendo imagen manual: ${uploadError.message}`);
    }

    const { error: insertError } = await supabase.from("cotizacion_fotos").insert({
      cotizacion_id: cotizacionId,
      storage_path: path,
      caption,
      orden,
      origen: "manual"
    });

    if (insertError) {
      throw new Error(`Error registrando imagen manual: ${insertError.message}`);
    }

    orden += 1;
  }
}

async function getClienteAIU(clienteId: string) {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("configuracion_cotizacion_cliente")
    .select(
      "porcentaje_administracion, porcentaje_imprevisto, porcentaje_utilidad, porcentaje_iva_utilidad, aplica_iva_sobre_utilidad"
    )
    .eq("cliente_id", clienteId)
    .maybeSingle();

  return {
    pctAdministracion: Number(data?.porcentaje_administracion ?? 0),
    pctImprevisto: Number(data?.porcentaje_imprevisto ?? 0),
    pctUtilidad: Number(data?.porcentaje_utilidad ?? 0),
    pctIvaUtilidad: Number(data?.porcentaje_iva_utilidad ?? 19),
    aplicaIva: Boolean(data?.aplica_iva_sobre_utilidad ?? true)
  };
}

function parseAiuFromForm(formData: FormData, defaults: TotalsInput): TotalsInput {
  return {
    pctAdministracion: toNumber(toText(formData, "pct_administracion"), defaults.pctAdministracion),
    pctImprevisto: toNumber(toText(formData, "pct_imprevisto"), defaults.pctImprevisto),
    pctUtilidad: toNumber(toText(formData, "pct_utilidad"), defaults.pctUtilidad),
    pctIvaUtilidad: toNumber(toText(formData, "pct_iva_utilidad"), defaults.pctIvaUtilidad),
    aplicaIva: formData.get("aplica_iva_utilidad") ? toBool(formData, "aplica_iva_utilidad") : defaults.aplicaIva
  };
}

export async function crearCotizacionAction(formData: FormData) {
  const role = await requireActionAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede crear cotizaciones."
  );

  const clienteId = toText(formData, "cliente_id");
  const inmuebleId = toText(formData, "inmueble_id");
  const requerimientoId = toText(formData, "requerimiento_id");
  const estadoDestino = toText(formData, "estado_destino");

  if (!clienteId || !inmuebleId || !requerimientoId) {
    return fail("/dashboard/cotizaciones/nueva", "Cliente, inmueble y requerimiento son obligatorios.");
  }

  const config = await getClienteAIU(clienteId);
  const aiu = parseAiuFromForm(formData, config);
  const estadoCotizacion = estadoDestino ?? "borrador";

  if (estadoCotizacion !== "borrador" && estadoCotizacion !== "en_revision_interna") {
    return fail("/dashboard/cotizaciones/nueva", "Estado no permitido al crear la cotización.");
  }

  if (!canAdministrarEstadoCotizacion(role, estadoCotizacion)) {
    return fail("/dashboard/cotizaciones/nueva", "Acceso denegado: solo administrador puede aprobar o enviar cotizaciones.");
  }

  const codigoCotizacion = toText(formData, "codigo_cotizacion") ?? generarCodigoCotizacion();
  const secciones = parseJson<SectionMap>(formData.get("secciones_json"), {});
  const rawItems = parseJson<CotizacionItemPayload[]>(formData.get("items_json"), []);
  const selectedFotos = parseJson<SelectedFotoPayload[]>(formData.get("selected_fotos_json"), []);
  const items = normalizeItems(rawItems);
  const totals = calcularTotales(items, aiu);

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("cotizaciones")
    .insert({
      codigo_cotizacion: codigoCotizacion,
      cliente_id: clienteId,
      inmueble_id: inmuebleId,
      requerimiento_id: requerimientoId,
      fecha_cotizacion: toText(formData, "fecha_cotizacion"),
      contacto_nombre: toText(formData, "contacto_nombre"),
      contacto_telefono: toText(formData, "contacto_telefono"),
      estado: estadoCotizacion,
      subtotal: totals.subtotal,
      porcentaje_administracion_base: config.pctAdministracion,
      porcentaje_administracion_editado: aiu.pctAdministracion,
      porcentaje_administracion_aplicado: aiu.pctAdministracion,
      valor_administracion: totals.valorAdministracion,
      porcentaje_imprevisto_base: config.pctImprevisto,
      porcentaje_imprevisto_editado: aiu.pctImprevisto,
      porcentaje_imprevisto_aplicado: aiu.pctImprevisto,
      valor_imprevisto: totals.valorImprevisto,
      porcentaje_utilidad_base: config.pctUtilidad,
      porcentaje_utilidad_editado: aiu.pctUtilidad,
      porcentaje_utilidad_aplicado: aiu.pctUtilidad,
      valor_utilidad: totals.valorUtilidad,
      porcentaje_iva_utilidad: aiu.pctIvaUtilidad,
      aplica_iva_sobre_utilidad: aiu.aplicaIva,
      valor_iva: totals.valorIva,
      total_sin_iva: totals.totalSinIva,
      total_final: totals.totalFinal,
      valida_hasta: toText(formData, "valida_hasta"),
      empresa_nombre: toText(formData, "empresa_nombre"),
      direccion_servicio: toText(formData, "direccion"),
      logo_url: toText(formData, "logo_url"),
      marca_agua_texto: toText(formData, "marca_agua_texto"),
      marca_agua_url: toText(formData, "marca_agua_url")
    })
    .select("id")
    .single();

  if (error || !data) {
    return fail("/dashboard/cotizaciones/nueva", error?.message ?? "No se pudo crear la cotización.");
  }

  try {
    await upsertSecciones(data.id, secciones);
    await upsertItems(data.id, items);
    await upsertFotosCotizacion(data.id, selectedFotos, formData);
  } catch (err) {
    return fail(`/dashboard/cotizaciones/${data.id}`, err instanceof Error ? err.message : "No se pudo guardar contenido.");
  }

  revalidatePath("/dashboard/cotizaciones");
  revalidatePath(`/dashboard/cotizaciones/${data.id}`);
  return ok(`/dashboard/cotizaciones/${data.id}`, `Cotización creada en estado ${estadoCotizacion}.`);
}

export async function actualizarCotizacionAction(formData: FormData) {
  const role = await requireActionAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede editar cotizaciones."
  );

  const cotizacionId = toText(formData, "cotizacion_id");
  const clienteId = toText(formData, "cliente_id");

  if (!cotizacionId || !clienteId) {
    return fail("/dashboard/cotizaciones", "No se pudo identificar la cotización.");
  }

  const config = await getClienteAIU(clienteId);
  const aiu = parseAiuFromForm(formData, config);

  const estadoDestino = toText(formData, "estado_destino");
  const secciones = parseJson<SectionMap>(formData.get("secciones_json"), {});
  const rawItems = parseJson<CotizacionItemPayload[]>(formData.get("items_json"), []);
  const selectedFotos = parseJson<SelectedFotoPayload[]>(formData.get("selected_fotos_json"), []);
  const items = normalizeItems(rawItems);
  const totals = calcularTotales(items, aiu);

  const supabase = createAdminClient();
  const { data: cotizacionActual, error: cotizacionError } = await supabase
    .from("cotizaciones")
    .select("estado")
    .eq("id", cotizacionId)
    .single();

  if (cotizacionError || !cotizacionActual) {
    return fail(`/dashboard/cotizaciones/${cotizacionId}`, "No se encontró la cotización.");
  }

  if (role === "asistente" && !["borrador", "en_revision_interna"].includes(cotizacionActual.estado)) {
    return fail(
      `/dashboard/cotizaciones/${cotizacionId}`,
      "Acceso denegado: asistente solo puede editar cotizaciones en borrador o en revisión interna."
    );
  }

  if (!canAdministrarEstadoCotizacion(role, estadoDestino)) {
    return fail(
      `/dashboard/cotizaciones/${cotizacionId}`,
      "Acceso denegado: solo administrador puede cambiar a aprobada internamente o enviada."
    );
  }

  const { error } = await supabase
    .from("cotizaciones")
    .update({
      codigo_cotizacion: toText(formData, "codigo_cotizacion"),
      cliente_id: clienteId,
      inmueble_id: toText(formData, "inmueble_id"),
      requerimiento_id: toText(formData, "requerimiento_id"),
      fecha_cotizacion: toText(formData, "fecha_cotizacion"),
      contacto_nombre: toText(formData, "contacto_nombre"),
      contacto_telefono: toText(formData, "contacto_telefono"),
      estado: estadoDestino ?? undefined,
      subtotal: totals.subtotal,
      porcentaje_administracion_base: config.pctAdministracion,
      porcentaje_administracion_editado: aiu.pctAdministracion,
      porcentaje_administracion_aplicado: aiu.pctAdministracion,
      valor_administracion: totals.valorAdministracion,
      porcentaje_imprevisto_base: config.pctImprevisto,
      porcentaje_imprevisto_editado: aiu.pctImprevisto,
      porcentaje_imprevisto_aplicado: aiu.pctImprevisto,
      valor_imprevisto: totals.valorImprevisto,
      porcentaje_utilidad_base: config.pctUtilidad,
      porcentaje_utilidad_editado: aiu.pctUtilidad,
      porcentaje_utilidad_aplicado: aiu.pctUtilidad,
      valor_utilidad: totals.valorUtilidad,
      porcentaje_iva_utilidad: aiu.pctIvaUtilidad,
      aplica_iva_sobre_utilidad: aiu.aplicaIva,
      valor_iva: totals.valorIva,
      total_sin_iva: totals.totalSinIva,
      total_final: totals.totalFinal,
      valida_hasta: toText(formData, "valida_hasta"),
      empresa_nombre: toText(formData, "empresa_nombre"),
      direccion_servicio: toText(formData, "direccion"),
      logo_url: toText(formData, "logo_url"),
      marca_agua_texto: toText(formData, "marca_agua_texto"),
      marca_agua_url: toText(formData, "marca_agua_url")
    })
    .eq("id", cotizacionId);

  if (error) {
    return fail(`/dashboard/cotizaciones/${cotizacionId}`, error.message);
  }

  try {
    await upsertSecciones(cotizacionId, secciones);
    await upsertItems(cotizacionId, items);
    await upsertFotosCotizacion(cotizacionId, selectedFotos, formData);
  } catch (err) {
    return fail(`/dashboard/cotizaciones/${cotizacionId}`, err instanceof Error ? err.message : "No se pudo guardar contenido.");
  }

  revalidatePath("/dashboard/cotizaciones");
  revalidatePath(`/dashboard/cotizaciones/${cotizacionId}`);
  return ok(`/dashboard/cotizaciones/${cotizacionId}`, "Cotización actualizada.");
}

export async function subirFotosCotizacionAction(formData: FormData) {
  await requireActionAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede cargar fotos de cotización."
  );

  const cotizacionId = toText(formData, "cotizacion_id");

  if (!cotizacionId) {
    return fail("/dashboard/cotizaciones", "No se pudo identificar la cotización para cargar fotos.");
  }

  const supabase = createAdminClient();
  const files = formData.getAll("fotos");
  let orden = toNumber(toText(formData, "orden_inicial"), 1);
  const caption = toText(formData, "caption");

  for (const fileEntry of files) {
    if (!(fileEntry instanceof File) || fileEntry.size === 0) {
      continue;
    }

    const fileName = sanitizeFilename(fileEntry.name || "foto.jpg");
    const path = `cotizaciones/${cotizacionId}/${Date.now()}-${fileName}`;

    const { error: uploadError } = await supabase.storage.from("evidences").upload(path, fileEntry, {
      upsert: false,
      contentType: fileEntry.type || "image/jpeg"
    });

    if (uploadError) {
      return fail(`/dashboard/cotizaciones/${cotizacionId}`, `Error subiendo imagen: ${uploadError.message}`);
    }

    const { error: insertError } = await supabase.from("cotizacion_fotos").insert({
      cotizacion_id: cotizacionId,
      storage_path: path,
      caption,
      orden,
      origen: "manual"
    });

    if (insertError) {
      return fail(`/dashboard/cotizaciones/${cotizacionId}`, `Error guardando foto: ${insertError.message}`);
    }

    orden += 1;
  }

  revalidatePath(`/dashboard/cotizaciones/${cotizacionId}`);
  return ok(`/dashboard/cotizaciones/${cotizacionId}`, "Fotos cargadas correctamente.");
}
