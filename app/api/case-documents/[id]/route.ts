import { NextResponse } from "next/server";

import { getCurrentUserPermissions } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

interface CaseDocumentRouteProps {
  params: Promise<{ id: string }>;
}

function safeFilename(filename: string | null | undefined) {
  return (filename || "soporte-caso").replace(/[\r\n"]/g, "_");
}

export async function GET(_request: Request, { params }: CaseDocumentRouteProps) {
  const ctx = await getCurrentUserPermissions();

  if (!ctx.userId) {
    return NextResponse.json({ error: "Debes iniciar sesión para ver este archivo." }, { status: 401 });
  }

  const canViewInternal = ctx.permissions.includes("ver_casos") || ctx.permissions.includes("editar_casos");
  const canViewClient = ctx.permissions.includes("ver_documentos_cliente") || ctx.permissions.includes("ver_evidencias_cliente");

  if (!canViewInternal && !canViewClient) {
    return NextResponse.json({ error: "No tienes permiso para ver este archivo." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createAdminClient() as any;

  const { data: documentRow, error: documentError } = await supabase
    .from("case_documents")
    .select("id, case_id, storage_path, original_filename, mime_type")
    .eq("id", id)
    .maybeSingle();

  if (documentError) {
    console.error("[api/case-documents] document query failed", { id, error: documentError.message });
    return NextResponse.json({ error: "No fue posible consultar el adjunto." }, { status: 500 });
  }

  if (!documentRow?.storage_path || !documentRow?.case_id) {
    return NextResponse.json({ error: "No se encontró el adjunto solicitado." }, { status: 404 });
  }

  if (ctx.normalizedRole === "cliente_inmobiliaria") {
    const { data: caseRow, error: caseError } = await supabase
      .from("cases")
      .select("client_id")
      .eq("id", documentRow.case_id)
      .maybeSingle();

    if (caseError) {
      console.error("[api/case-documents] case ownership query failed", {
        caseId: documentRow.case_id,
        error: caseError.message
      });
      return NextResponse.json({ error: "No fue posible validar el acceso al adjunto." }, { status: 500 });
    }

    if (!ctx.clientId || caseRow?.client_id !== ctx.clientId) {
      return NextResponse.json({ error: "Este archivo no pertenece a tu inmobiliaria." }, { status: 403 });
    }
  }

  const downloaded = await supabase.storage.from("evidences").download(documentRow.storage_path);
  if (downloaded.error || !downloaded.data) {
    console.error("[api/case-documents] storage download failed", {
      documentId: id,
      storagePath: documentRow.storage_path,
      error: downloaded.error?.message
    });
    return NextResponse.json({ error: "No fue posible descargar el archivo desde almacenamiento." }, { status: 404 });
  }

  const filename = safeFilename(documentRow.original_filename);
  const contentType = documentRow.mime_type || downloaded.data.type || "application/octet-stream";

  return new NextResponse(downloaded.data, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=60"
    }
  });
}
