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

function backTo(formData: FormData, fallback: string) {
  return toText(formData, "return_path") ?? fallback;
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function ok(path: string, message: string): never {
  redirect(`${path}?ok=${encodeURIComponent(message)}`);
}

export async function crearCategoriaInventarioAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al crear categorías.");

  const path = backTo(formData, "/dashboard/almacen/materiales");
  const name = toText(formData, "name");

  if (!name) {
    return fail(path, "El nombre de la categoría es obligatorio.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("inventory_categories").insert({ name, active: true });

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/almacen");
  revalidatePath("/dashboard/almacen/materiales");
  return ok(path, "Categoría de inventario creada.");
}

export async function crearUbicacionAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al crear ubicaciones.");

  const path = backTo(formData, "/dashboard/almacen/materiales");
  const name = toText(formData, "name");

  if (!name) {
    return fail(path, "El nombre de la ubicación es obligatorio.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("storage_locations").insert({
    name,
    description: toText(formData, "description"),
    active: true
  });

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/almacen");
  revalidatePath("/dashboard/almacen/materiales");
  revalidatePath("/dashboard/almacen/herramientas");
  return ok(path, "Ubicación creada.");
}

export async function crearMaterialAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al crear materiales.");

  const path = backTo(formData, "/dashboard/almacen/materiales");
  const code = toText(formData, "code");
  const name = toText(formData, "name");
  const categoryId = toText(formData, "category_id");
  const unit = toText(formData, "unit");

  if (!code || !name || !categoryId || !unit) {
    return fail(path, "Código, nombre, categoría y unidad son obligatorios.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("inventory_items").insert({
    code: code.toUpperCase(),
    name,
    category_id: categoryId,
    unit,
    stock_current: toNumber(toText(formData, "stock_current"), 0),
    stock_min: toNumber(toText(formData, "stock_min"), 0),
    average_unit_cost: toNumber(toText(formData, "average_unit_cost"), 0),
    storage_location_id: toText(formData, "storage_location_id"),
    qr_code: toText(formData, "qr_code"),
    active: true
  });

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/almacen");
  revalidatePath("/dashboard/almacen/materiales");
  return ok(path, "Material creado.");
}

export async function actualizarMaterialAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al editar materiales.");

  const path = backTo(formData, "/dashboard/almacen/materiales");
  const id = toText(formData, "id");

  if (!id) {
    return fail(path, "No se pudo identificar el material.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("inventory_items")
    .update({
      code: toText(formData, "code")?.toUpperCase(),
      name: toText(formData, "name"),
      category_id: toText(formData, "category_id"),
      unit: toText(formData, "unit"),
      stock_min: toNumber(toText(formData, "stock_min"), 0),
      average_unit_cost: toNumber(toText(formData, "average_unit_cost"), 0),
      storage_location_id: toText(formData, "storage_location_id"),
      qr_code: toText(formData, "qr_code"),
      active: toText(formData, "active") === "si"
    })
    .eq("id", id);

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/almacen");
  revalidatePath("/dashboard/almacen/materiales");
  revalidatePath("/dashboard/almacen/qr");
  return ok(path, "Material actualizado.");
}

export async function toggleMaterialAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al cambiar estado de material.");

  const path = backTo(formData, "/dashboard/almacen/materiales");
  const id = toText(formData, "id");
  const active = toText(formData, "active") === "si";

  if (!id) {
    return fail(path, "No se pudo identificar el material.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("inventory_items").update({ active: !active }).eq("id", id);

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/almacen/materiales");
  return ok(path, "Estado del material actualizado.");
}

export async function registrarMovimientoInventarioAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al registrar movimientos.");

  const path = backTo(formData, "/dashboard/almacen/materiales");
  const itemId = toText(formData, "item_id");
  const movementType = toText(formData, "movement_type");
  const quantity = toNumber(toText(formData, "quantity"), 0);

  if (!itemId || !movementType || quantity === 0) {
    return fail(path, "Item, tipo de movimiento y cantidad son obligatorios.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("inventory_movements").insert({
    item_id: itemId,
    movement_type: movementType,
    quantity,
    unit_cost: toNumber(toText(formData, "unit_cost"), 0),
    case_id: toText(formData, "case_id"),
    work_order_id: toText(formData, "work_order_id"),
    performed_by: toText(formData, "performed_by"),
    notes: toText(formData, "notes")
  });

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/almacen");
  revalidatePath("/dashboard/almacen/materiales");
  revalidatePath("/dashboard/requerimientos");
  return ok(path, "Movimiento registrado.");
}

export async function crearCategoriaHerramientaAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al crear categorías de herramienta.");

  const path = backTo(formData, "/dashboard/almacen/herramientas");
  const name = toText(formData, "name");

  if (!name) {
    return fail(path, "El nombre de la categoría es obligatorio.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("tool_categories").insert({ name, active: true });

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/almacen/herramientas");
  return ok(path, "Categoría de herramienta creada.");
}

export async function crearHerramientaAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al crear herramientas.");

  const path = backTo(formData, "/dashboard/almacen/herramientas");
  const code = toText(formData, "code");
  const name = toText(formData, "name");
  const categoryId = toText(formData, "category_id");

  if (!code || !name || !categoryId) {
    return fail(path, "Código, nombre y categoría son obligatorios.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("tools").insert({
    code: code.toUpperCase(),
    name,
    serial_number: toText(formData, "serial_number"),
    category_id: categoryId,
    purchase_date: toText(formData, "purchase_date"),
    purchase_cost: toNumber(toText(formData, "purchase_cost"), 0) || null,
    condition_status: toText(formData, "condition_status") ?? "buena",
    operational_status: toText(formData, "operational_status") ?? "disponible",
    storage_location_id: toText(formData, "storage_location_id"),
    qr_code: toText(formData, "qr_code"),
    active: true
  });

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/almacen");
  revalidatePath("/dashboard/almacen/herramientas");
  return ok(path, "Herramienta creada.");
}

export async function actualizarHerramientaAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al editar herramientas.");

  const path = backTo(formData, "/dashboard/almacen/herramientas");
  const id = toText(formData, "id");

  if (!id) {
    return fail(path, "No se pudo identificar la herramienta.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("tools")
    .update({
      code: toText(formData, "code")?.toUpperCase(),
      name: toText(formData, "name"),
      serial_number: toText(formData, "serial_number"),
      category_id: toText(formData, "category_id"),
      purchase_date: toText(formData, "purchase_date"),
      purchase_cost: toNumber(toText(formData, "purchase_cost"), 0) || null,
      condition_status: toText(formData, "condition_status"),
      operational_status: toText(formData, "operational_status"),
      storage_location_id: toText(formData, "storage_location_id"),
      qr_code: toText(formData, "qr_code"),
      active: toText(formData, "active") === "si"
    })
    .eq("id", id);

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/almacen");
  revalidatePath("/dashboard/almacen/herramientas");
  revalidatePath("/dashboard/almacen/qr");
  return ok(path, "Herramienta actualizada.");
}

export async function toggleHerramientaAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al cambiar estado de herramienta.");

  const path = backTo(formData, "/dashboard/almacen/herramientas");
  const id = toText(formData, "id");
  const active = toText(formData, "active") === "si";

  if (!id) {
    return fail(path, "No se pudo identificar la herramienta.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("tools").update({ active: !active }).eq("id", id);

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/almacen/herramientas");
  return ok(path, "Estado de herramienta actualizado.");
}

export async function asignarHerramientaAction(formData: FormData) {
  await requireActionAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al asignar herramientas.");

  const path = backTo(formData, "/dashboard/almacen/herramientas");
  const toolId = toText(formData, "tool_id");

  if (!toolId) {
    return fail(path, "Debes seleccionar una herramienta.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("tool_assignments").insert({
    tool_id: toolId,
    assigned_to_user_id: toText(formData, "assigned_to_user_id"),
    case_id: toText(formData, "case_id"),
    work_order_id: toText(formData, "work_order_id"),
    assigned_at: toText(formData, "assigned_at"),
    expected_return_at: toText(formData, "expected_return_at"),
    delivery_condition: toText(formData, "delivery_condition"),
    status: "asignada",
    notes: toText(formData, "notes")
  });

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/almacen");
  revalidatePath("/dashboard/almacen/herramientas");
  revalidatePath("/dashboard/requerimientos");
  return ok(path, "Herramienta asignada.");
}

export async function devolverHerramientaAction(formData: FormData) {
  const role = await requireActionAccess(
    ["administrador", "asistente", "tecnico"],
    "/dashboard",
    "Acceso denegado al devolver herramientas."
  );

  const path = backTo(formData, "/dashboard/almacen/herramientas");
  const assignmentId = toText(formData, "assignment_id");
  const status = toText(formData, "status") ?? "devuelta";

  if (!assignmentId) {
    return fail(path, "No se pudo identificar la asignación.");
  }

  const supabase = createAdminClient();
  if (role === "tecnico") {
    const client = (await createClient()) as any;
    const {
      data: { user }
    } = await client.auth.getUser();

    const { data: assignment } = await supabase
      .from("tool_assignments")
      .select("assigned_to_user_id")
      .eq("id", assignmentId)
      .maybeSingle();

    if (!user || !assignment || assignment.assigned_to_user_id !== user.id) {
      return fail(path, "Acceso denegado: solo puedes devolver herramientas asignadas a tu usuario.");
    }
  }

  const { error } = await supabase
    .from("tool_assignments")
    .update({
      returned_at: toText(formData, "returned_at") ?? new Date().toISOString(),
      return_condition: toText(formData, "return_condition"),
      status
    })
    .eq("id", assignmentId);

  if (error) {
    return fail(path, error.message);
  }

  revalidatePath("/dashboard/almacen");
  revalidatePath("/dashboard/almacen/herramientas");
  revalidatePath("/dashboard/requerimientos");
  return ok(path, "Asignación actualizada.");
}

export async function registrarMantenimientoHerramientaAction(formData: FormData) {
  await requireActionAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado al registrar mantenimientos."
  );

  const path = backTo(formData, "/dashboard/almacen/herramientas");
  const toolId = toText(formData, "tool_id");
  const maintenanceType = toText(formData, "maintenance_type");
  const description = toText(formData, "description");

  if (!toolId || !maintenanceType || !description) {
    return fail(path, "Herramienta, tipo y descripción son obligatorios.");
  }

  const supabase = createAdminClient();
  const [{ error: insertError }, { error: updateError }] = await Promise.all([
    supabase.from("tool_maintenance_logs").insert({
      tool_id: toolId,
      maintenance_type: maintenanceType,
      description,
      maintenance_date: toText(formData, "maintenance_date"),
      cost: toNumber(toText(formData, "cost"), 0) || null,
      performed_by: toText(formData, "performed_by"),
      next_maintenance_date: toText(formData, "next_maintenance_date")
    }),
    supabase.from("tools").update({ operational_status: "mantenimiento" }).eq("id", toolId)
  ]);

  if (insertError || updateError) {
    return fail(path, insertError?.message ?? updateError?.message ?? "No se pudo registrar mantenimiento.");
  }

  revalidatePath("/dashboard/almacen");
  revalidatePath("/dashboard/almacen/herramientas");
  return ok(path, "Mantenimiento registrado y herramienta movida a estado mantenimiento.");
}
