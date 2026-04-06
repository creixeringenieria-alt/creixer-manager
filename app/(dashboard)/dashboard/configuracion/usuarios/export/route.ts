import { NextResponse } from "next/server";

import { isValidRole, normalizeRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function csvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function GET() {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const admin = createAdminClient() as any;
  const { data: currentProfile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: `No se pudo validar rol: ${profileError.message}` }, { status: 500 });
  }

  const roleFromProfile =
    typeof currentProfile?.role === "string" && isValidRole(currentProfile.role) ? currentProfile.role : null;
  const metaRole =
    (typeof user.app_metadata?.role === "string" && isValidRole(user.app_metadata.role) ? user.app_metadata.role : null) ??
    (typeof user.user_metadata?.role === "string" && isValidRole(user.user_metadata.role) ? user.user_metadata.role : null);

  const normalized = normalizeRole(roleFromProfile ?? metaRole ?? null);
  if (normalized !== "super_admin") {
    return NextResponse.json({ error: "Acceso denegado. Solo super_admin puede exportar usuarios." }, { status: 403 });
  }

  const { data: rows, error } = await admin
    .from("user_profiles_export")
    .select("*")
    .order("user_type", { ascending: true })
    .order("full_name", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: `No fue posible generar exportación: ${error.message}` }, { status: 500 });
  }

  const headers = [
    "id",
    "full_name",
    "email",
    "role",
    "user_type",
    "organization_or_client",
    "client_id",
    "client_name",
    "document_type",
    "document_number",
    "phone",
    "is_active",
    "basic_data_locked",
    "fecha_nacimiento",
    "grupo_sanguineo_rh",
    "eps",
    "arl",
    "fondo_pension",
    "fondo_cesantias",
    "direccion_residencia",
    "ciudad_residencia",
    "contacto_emergencia_nombre",
    "contacto_emergencia_telefono",
    "parentesco_contacto_emergencia",
    "observaciones_medicas_relevantes",
    "created_at",
    "updated_at"
  ];

  const authUsersById = new Map<string, string | null>();
  let page = 1;
  let keepGoing = true;

  while (keepGoing) {
    const { data: listData, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (listError) {
      return NextResponse.json({ error: `No fue posible cargar correos de Auth: ${listError.message}` }, { status: 500 });
    }

    const users = listData?.users ?? [];
    users.forEach((authUser: { id: string; email?: string | null }) => {
      authUsersById.set(authUser.id, authUser.email ?? null);
    });

    keepGoing = users.length === 1000;
    page += 1;
  }

  const lines = [headers.join(",")];

  for (const row of rows ?? []) {
    const values = headers.map((header) => {
      if (header === "email") {
        return csvValue(authUsersById.get(row.id) ?? "");
      }
      return csvValue(row[header]);
    });
    lines.push(values.join(","));
  }

  const csv = `${lines.join("\n")}\n`;
  const filename = `usuarios_creixer_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
