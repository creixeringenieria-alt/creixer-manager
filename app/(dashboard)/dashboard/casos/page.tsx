import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

interface CasosPageProps {
  searchParams: Promise<{ estado_financiero?: string; tipo?: string }>;
}

export default async function CasosPage({ searchParams }: CasosPageProps) {
  await requirePageAccess(
    ["administrador", "asistente", "contabilidad", "tecnico"],
    "/dashboard",
    "Acceso denegado: tu rol no puede ver la consolidación de casos."
  );

  const params = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from("financial_records")
    .select(
      "id, case_type, estado_financiero, valor_aprobado, valor_facturado, valor_cobrado, saldo_por_cobrar, requerimiento_id, technical_project_id, requerimientos(codigo_requerimiento), technical_projects(name)"
    )
    .order("updated_at", { ascending: false })
    .limit(300);

  if (params.tipo) {
    query = query.eq("case_type", params.tipo);
  }
  if (params.estado_financiero) {
    query = query.eq("estado_financiero", params.estado_financiero);
  }

  const casesResp = await query;
  const rows = casesResp.data ?? [];

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Casos / Proyectos consolidados</h1>
          <p>Vista unificada para seguimiento operativo, comercial y financiero.</p>
        </div>
        <Link href="/dashboard">Volver</Link>
      </div>

      <section className="card">
        <h2>Filtros</h2>
        <form method="GET" className="inline-form">
          <select name="tipo" defaultValue={params.tipo ?? ""}>
            <option value="">Todos los tipos</option>
            <option value="requerimiento">requerimiento</option>
            <option value="proyecto_tecnico">proyecto_tecnico</option>
          </select>
          <select name="estado_financiero" defaultValue={params.estado_financiero ?? ""}>
            <option value="">Todos los estados financieros</option>
            <option value="sin_cotizacion">sin_cotizacion</option>
            <option value="cotizado">cotizado</option>
            <option value="aprobado">aprobado</option>
            <option value="anticipo_pendiente">anticipo_pendiente</option>
            <option value="en_ejecucion">en_ejecucion</option>
            <option value="facturacion_pendiente">facturacion_pendiente</option>
            <option value="facturado_parcial">facturado_parcial</option>
            <option value="facturado_total">facturado_total</option>
            <option value="cartera_pendiente">cartera_pendiente</option>
            <option value="cerrado">cerrado</option>
          </select>
          <button type="submit">Aplicar</button>
        </form>
      </section>

      <section className="card">
        <h2>Listado</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Caso/Proyecto</th>
                <th>Tipo</th>
                <th>Estado financiero</th>
                <th>Aprobado</th>
                <th>Facturado</th>
                <th>Cobrado</th>
                <th>Saldo cobrar</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {(row.requerimientos as { codigo_requerimiento?: string } | null)?.codigo_requerimiento ??
                      (row.technical_projects as { name?: string } | null)?.name ??
                      "-"}
                  </td>
                  <td>{row.case_type}</td>
                  <td>{row.estado_financiero}</td>
                  <td>{Number(row.valor_aprobado).toLocaleString("es-CO")}</td>
                  <td>{Number(row.valor_facturado).toLocaleString("es-CO")}</td>
                  <td>{Number(row.valor_cobrado).toLocaleString("es-CO")}</td>
                  <td>{Number(row.saldo_por_cobrar).toLocaleString("es-CO")}</td>
                  <td>
                    <Link href={`/dashboard/casos/${row.id}`}>Abrir vista única</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
