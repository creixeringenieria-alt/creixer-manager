import Link from "next/link";

import CotizacionEditor from "@/components/cotizaciones/CotizacionEditor";
import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { crearCotizacionAction } from "../actions";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function NuevaCotizacionPage() {
  await requirePageAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede crear cotizaciones."
  );

  const supabase = createAdminClient();

  const [clientesResp, inmueblesResp, requerimientosResp, cfgResp, fotosVisitaResp, actividadesResp] = await Promise.all([
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
      .eq("activa", true)
      .order("nombre_actividad")
  ]);

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

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Nueva cotización</h1>
          <p>Construye una cotización técnica con estructura profesional.</p>
        </div>
        <Link href="/dashboard/cotizaciones">Volver al listado</Link>
      </div>

      <CotizacionEditor
        mode="create"
        submitLabel="Enviar a revisión interna"
        submitAction={crearCotizacionAction}
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
          codigoCotizacion: "",
          clienteId: "",
          inmuebleId: "",
          requerimientoId: "",
          fechaCotizacion: today(),
          contactoNombre: "",
          contactoTelefono: "",
          validaHasta: "",
          empresaNombre: "Creixer Manager",
          logoUrl: "",
          marcaAguaTexto: "CREIXER",
          marcaAguaUrl: "",
          direccion: "",
          pctAdministracion: 0,
          pctImprevisto: 0,
          pctUtilidad: 0,
          pctIvaUtilidad: 19,
          aplicaIvaUtilidad: true,
          secciones: {
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
          },
          items: [{ item: 1, actividadId: "", descripcion: "", cantidad: 1, unidad: "und", vrUnitario: 0 }],
          selectedFotos: []
        }}
      />
    </main>
  );
}
