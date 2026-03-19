import Link from "next/link";

import CotizacionEditor from "@/components/cotizaciones/CotizacionEditor";
import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { actualizarCotizacionAction, subirFotosCotizacionAction } from "../actions";

interface CotizacionDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}

function toDateInput(value: string | null) {
  if (!value) {
    return "";
  }
  return String(value).slice(0, 10);
}

export default async function CotizacionDetailPage({ params, searchParams }: CotizacionDetailPageProps) {
  const role = await requirePageAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede editar cotizaciones."
  );

  const { id } = await params;
  const query = await searchParams;
  const supabase = createAdminClient();

  const [
    cotizacionResp,
    seccionesResp,
    itemsResp,
    fotosResp,
    clientesResp,
    inmueblesResp,
    requerimientosResp,
    cfgResp,
    fotosVisitaResp,
    actividadesResp
  ] = await Promise.all([
    supabase
      .from("cotizaciones")
      .select("id, codigo_cotizacion, cliente_id, inmueble_id, requerimiento_id, fecha_cotizacion, contacto_nombre, contacto_telefono, valida_hasta, empresa_nombre, direccion_servicio, logo_url, marca_agua_texto, marca_agua_url, porcentaje_administracion_aplicado, porcentaje_imprevisto_aplicado, porcentaje_utilidad_aplicado, porcentaje_iva_utilidad, aplica_iva_sobre_utilidad")
      .eq("id", id)
      .single(),
    supabase.from("cotizacion_secciones").select("tipo_seccion, contenido").eq("cotizacion_id", id),
    supabase
      .from("cotizacion_items")
      .select("item_numero, actividad_id, descripcion, cantidad, unidad, valor_unitario")
      .eq("cotizacion_id", id)
      .order("orden", { ascending: true }),
    supabase
      .from("cotizacion_fotos")
      .select("id, storage_path, caption, orden, origen, reporte_visita_foto_id, created_at")
      .eq("cotizacion_id", id)
      .order("orden", { ascending: true }),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("properties").select("id, name, address").order("name"),
    supabase
      .from("requerimientos")
      .select("id, codigo_requerimiento, descripcion")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("configuracion_cotizacion_cliente")
      .select(
        "cliente_id, porcentaje_administracion, porcentaje_imprevisto, porcentaje_utilidad, porcentaje_iva_utilidad, aplica_iva_sobre_utilidad"
      ),
    supabase
      .from("reporte_visita_fotos")
      .select("id, storage_path, descripcion, reportes_visita!inner(agenda_operativa!inner(requerimiento_id))")
    ,
    supabase
      .from("actividades_catalogo")
      .select("id, nombre_actividad, descripcion_tecnica, unidad, precio_referencial")
      .order("nombre_actividad")
  ]);

  if (cotizacionResp.error || !cotizacionResp.data) {
    return (
      <main>
        <p className="feedback error">No se encontró la cotización.</p>
        <Link href="/dashboard/cotizaciones">Volver</Link>
      </main>
    );
  }

  const secciones = {
    introduccion: "",
    objetivo_general: "",
    objetivos_especificos: "",
    diagnostico_preliminar: "",
    alcance: "",
    garantia: "",
    tiempo_ejecucion: "",
    notas_importantes: "",
    forma_pago: "",
    firma_final: ""
  };

  for (const section of seccionesResp.data ?? []) {
    secciones[section.tipo_seccion as keyof typeof secciones] = section.contenido ?? "";
  }

  const aiuConfigByCliente = Object.fromEntries(
    (cfgResp.data ?? []).map((row) => [
      row.cliente_id,
      {
        pctAdministracion: Number(row.porcentaje_administracion ?? 0),
        pctImprevisto: Number(row.porcentaje_imprevisto ?? 0),
        pctUtilidad: Number(row.porcentaje_utilidad ?? 0),
        pctIvaUtilidad: Number(row.porcentaje_iva_utilidad ?? 19),
        aplicaIva: Boolean(row.aplica_iva_sobre_utilidad ?? true)
      }
    ])
  );

  const visitaFotosDisponibles = (fotosVisitaResp.data ?? [])
    .map((foto) => {
      const requerimientoId =
        ((foto.reportes_visita as { agenda_operativa?: { requerimiento_id?: string } } | null)?.agenda_operativa as
          | { requerimiento_id?: string }
          | undefined)?.requerimiento_id ?? null;

      if (!requerimientoId) {
        return null;
      }

      return {
        id: foto.id,
        requerimientoId,
        storagePath: foto.storage_path,
        descripcion: foto.descripcion ?? "",
        origen: "reporte_visita" as const
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const selectedFotos = (fotosResp.data ?? []).map((foto) => ({
    key: foto.id,
    storage_path: foto.storage_path,
    descripcion: foto.caption ?? "",
    orden: Number(foto.orden ?? 1),
    origen: (foto.origen as "manual" | "reporte_visita") ?? "manual",
    reporte_visita_foto_id: foto.reporte_visita_foto_id
  }));

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Editar cotización</h1>
          <p>Código: {cotizacionResp.data.codigo_cotizacion}</p>
        </div>
        <div className="inline-form">
          <Link href="/dashboard/cotizaciones">Volver al listado</Link>
          <Link href={`/dashboard/documentos/cotizaciones/${id}`}>Ver documento</Link>
        </div>
      </div>

      {query.error ? <p className="feedback error">{query.error}</p> : null}
      {query.ok ? <p className="feedback success">{query.ok}</p> : null}

      <CotizacionEditor
        mode="edit"
        submitLabel="Guardar cambios"
        submitAction={actualizarCotizacionAction}
        canAprobarInternamente={role === "administrador"}
        documentPath={`/dashboard/documentos/cotizaciones/${id}`}
        options={{
          clientes: (clientesResp.data ?? []).map((row) => ({ id: row.id, label: row.name })),
          inmuebles: (inmueblesResp.data ?? []).map((row) => ({
            id: row.id,
            label: `${row.name}${row.address ? ` - ${row.address}` : ""}`
          })),
          requerimientos: (requerimientosResp.data ?? []).map((row) => ({
            id: row.id,
            label: `${row.codigo_requerimiento} - ${row.descripcion.slice(0, 60)}`
          })),
          aiuConfigByCliente,
          visitaFotosDisponibles,
          actividades: (actividadesResp.data ?? []).map((row) => ({
            id: row.id,
            nombre: row.nombre_actividad,
            descripcion: row.descripcion_tecnica ?? row.nombre_actividad,
            unidad: row.unidad,
            precio: Number(row.precio_referencial ?? 0)
          }))
        }}
        defaults={{
          cotizacionId: cotizacionResp.data.id,
          codigoCotizacion: cotizacionResp.data.codigo_cotizacion,
          clienteId: cotizacionResp.data.cliente_id,
          inmuebleId: cotizacionResp.data.inmueble_id,
          requerimientoId: cotizacionResp.data.requerimiento_id,
          fechaCotizacion: toDateInput(cotizacionResp.data.fecha_cotizacion),
          contactoNombre: cotizacionResp.data.contacto_nombre ?? "",
          contactoTelefono: cotizacionResp.data.contacto_telefono ?? "",
          validaHasta: toDateInput(cotizacionResp.data.valida_hasta),
          empresaNombre: cotizacionResp.data.empresa_nombre ?? "Creixer Manager",
          logoUrl: cotizacionResp.data.logo_url ?? "",
          marcaAguaTexto: cotizacionResp.data.marca_agua_texto ?? "CREIXER",
          marcaAguaUrl: cotizacionResp.data.marca_agua_url ?? "",
          direccion: cotizacionResp.data.direccion_servicio ?? "",
          pctAdministracion: Number(cotizacionResp.data.porcentaje_administracion_aplicado ?? 0),
          pctImprevisto: Number(cotizacionResp.data.porcentaje_imprevisto_aplicado ?? 0),
          pctUtilidad: Number(cotizacionResp.data.porcentaje_utilidad_aplicado ?? 0),
          pctIvaUtilidad: Number(cotizacionResp.data.porcentaje_iva_utilidad ?? 19),
          aplicaIvaUtilidad: Boolean(cotizacionResp.data.aplica_iva_sobre_utilidad ?? true),
          secciones,
          items: (itemsResp.data ?? []).map((item, index) => ({
            item: item.item_numero ?? index + 1,
            actividadId: item.actividad_id ?? "",
            descripcion: item.descripcion,
            cantidad: Number(item.cantidad),
            unidad: item.unidad ?? "und",
            vrUnitario: Number(item.valor_unitario)
          })),
          selectedFotos
        }}
      />

      <section className="card">
        <h2>Carga manual de fotos adicionales</h2>
        <form action={subirFotosCotizacionAction} className="inline-form">
          <input type="hidden" name="cotizacion_id" value={id} />
          <input type="file" name="fotos" multiple accept="image/*" />
          <input name="caption" placeholder="Descripción opcional" />
          <input type="number" min="1" name="orden_inicial" placeholder="Orden inicial" />
          <button type="submit">Subir fotos</button>
        </form>
      </section>
    </main>
  );
}
