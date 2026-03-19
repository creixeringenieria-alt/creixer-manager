import Link from "next/link";

import CotizacionDocumento from "@/components/documentos/CotizacionDocumento";
import PrintButton from "@/components/documentos/PrintButton";
import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

interface CotizacionDocumentoPageProps {
  params: Promise<{ id: string }>;
}

function toPublicUrl(supabase: ReturnType<typeof createAdminClient>, path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return supabase.storage.from("evidences").getPublicUrl(path).data.publicUrl;
}

export default async function CotizacionDocumentoPage({ params }: CotizacionDocumentoPageProps) {
  await requirePageAccess(
    ["administrador", "asistente", "contabilidad"],
    "/dashboard",
    "Acceso denegado: tu rol no puede ver documentos de cotización."
  );

  const { id } = await params;
  const supabase = createAdminClient();

  const [cotizacionResp, seccionesResp, itemsResp, fotosResp] = await Promise.all([
    supabase
      .from("cotizaciones")
      .select(
        "id, codigo_cotizacion, fecha_cotizacion, contacto_nombre, contacto_telefono, direccion_servicio, logo_url, marca_agua_texto, marca_agua_url, subtotal, valor_administracion, valor_imprevisto, valor_utilidad, valor_iva, total_final, clients(name), properties(name, address), requerimientos(codigo_requerimiento)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("cotizacion_secciones").select("tipo_seccion, contenido").eq("cotizacion_id", id),
    supabase
      .from("cotizacion_items")
      .select("item_numero, descripcion, cantidad, unidad, valor_unitario, valor_total")
      .eq("cotizacion_id", id)
      .order("orden", { ascending: true }),
    supabase
      .from("cotizacion_fotos")
      .select("storage_path, caption, orden")
      .eq("cotizacion_id", id)
      .order("orden", { ascending: true })
  ]);

  if (!cotizacionResp.data) {
    return (
      <main>
        <p className="feedback error">No se encontró la cotización.</p>
        <Link href="/dashboard/cotizaciones">Volver</Link>
      </main>
    );
  }

  const secciones = Object.fromEntries((seccionesResp.data ?? []).map((row) => [row.tipo_seccion, row.contenido ?? ""]));

  return (
    <main>
      <div className="page-header doc-screen-toolbar">
        <div>
          <h1>Documento de cotización</h1>
          <p>Plantilla corporativa unificada para presentación comercial.</p>
        </div>
        <div className="inline-form">
          <PrintButton />
          <Link href={`/dashboard/cotizaciones/${id}`}>Volver a cotización</Link>
        </div>
      </div>

      <CotizacionDocumento
        codigo={cotizacionResp.data.codigo_cotizacion}
        fecha={String(cotizacionResp.data.fecha_cotizacion)}
        cliente={(cotizacionResp.data.clients as { name?: string } | null)?.name ?? "-"}
        inmueble={(cotizacionResp.data.properties as { name?: string } | null)?.name ?? "-"}
        direccion={
          cotizacionResp.data.direccion_servicio ??
          (cotizacionResp.data.properties as { address?: string } | null)?.address ??
          "-"
        }
        contacto={`${cotizacionResp.data.contacto_nombre ?? ""} ${cotizacionResp.data.contacto_telefono ?? ""}`.trim()}
        requerimiento={(cotizacionResp.data.requerimientos as { codigo_requerimiento?: string } | null)?.codigo_requerimiento ?? "-"}
        logoUrl={cotizacionResp.data.logo_url || "/logo-creixer.png"}
        watermarkUrl={cotizacionResp.data.marca_agua_url ?? ""}
        watermarkText={cotizacionResp.data.marca_agua_texto ?? "CREIXER INGENIERIA"}
        secciones={secciones}
        items={(itemsResp.data ?? []).map((item) => ({
          item_numero: item.item_numero,
          descripcion: item.descripcion,
          cantidad: Number(item.cantidad),
          unidad: item.unidad,
          valor_unitario: Number(item.valor_unitario),
          valor_total: Number(item.valor_total)
        }))}
        subtotal={Number(cotizacionResp.data.subtotal ?? 0)}
        valorAdministracion={Number(cotizacionResp.data.valor_administracion ?? 0)}
        valorImprevisto={Number(cotizacionResp.data.valor_imprevisto ?? 0)}
        valorUtilidad={Number(cotizacionResp.data.valor_utilidad ?? 0)}
        valorIva={Number(cotizacionResp.data.valor_iva ?? 0)}
        total={Number(cotizacionResp.data.total_final ?? 0)}
        fotos={(fotosResp.data ?? []).map((foto) => ({
          url: toPublicUrl(supabase, foto.storage_path),
          caption: foto.caption
        }))}
      />
    </main>
  );
}
