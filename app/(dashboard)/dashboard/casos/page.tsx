import Link from "next/link";

import { getCurrentUserPermissions, requirePagePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

interface CasosPageProps {
  searchParams: Promise<{ estado_financiero?: string; tipo?: string }>;
}

export default async function CasosPage({ searchParams }: CasosPageProps) {
  const permissionContext = await getCurrentUserPermissions();
  const isClientInmobiliaria = permissionContext.permissions.includes("ver_casos_cliente");
  const missingClientAssociation = isClientInmobiliaria && !permissionContext.clientId;
  if (permissionContext.permissions.includes("ver_casos")) {
    await requirePagePermission("ver_casos", "/dashboard", "Acceso denegado: tu rol no puede ver casos.");
  } else if (permissionContext.permissions.includes("ver_casos_cliente")) {
    await requirePagePermission("ver_casos_cliente", "/dashboard", "Acceso denegado: tu rol no puede ver casos de inmobiliaria.");
  } else {
    await requirePagePermission("ver_casos_propios", "/dashboard", "Acceso denegado: solo puedes ver casos propios.");
  }

  const params = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from("financial_records")
    .select(
      "id, case_type, estado_financiero, valor_aprobado, valor_facturado, valor_cobrado, saldo_por_cobrar, requerimiento_id, technical_project_id, requerimientos(cliente_id, codigo_requerimiento), technical_projects(client_id, name)"
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
  let rows = casesResp.data ?? [];

  if (permissionContext.permissions.includes("ver_casos_cliente")) {
    const clientId = permissionContext.clientId;
    if (!clientId) {
      rows = [];
    } else {
      rows = rows.filter((row) => {
        const reqClientId = (row.requerimientos as { cliente_id?: string } | null)?.cliente_id ?? null;
        const projectClientId = (row.technical_projects as { client_id?: string } | null)?.client_id ?? null;
        return reqClientId === clientId || projectClientId === clientId;
      });
    }
  } else if (!permissionContext.permissions.includes("ver_casos") && permissionContext.userId) {
    const tecnicoId = permissionContext.userId;
    const [agendasPropiasResp, tareasProyectoResp] = await Promise.all([
      supabase.from("agenda_operativa").select("requerimiento_id").eq("tecnico_id", tecnicoId),
      supabase.from("technical_project_tasks").select("project_id").eq("responsible_user_id", tecnicoId)
    ]);

    const requerimientoIds = new Set((agendasPropiasResp.data ?? []).map((row) => row.requerimiento_id));
    const projectIds = new Set((tareasProyectoResp.data ?? []).map((row) => row.project_id));

    rows = rows.filter(
      (row) =>
        (row.requerimiento_id && requerimientoIds.has(row.requerimiento_id)) ||
        (row.technical_project_id && projectIds.has(row.technical_project_id))
    );
  }

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
        {missingClientAssociation ? (
          <p className="feedback error">Tu usuario no tiene inmobiliaria asociada. Contacta al administrador.</p>
        ) : null}
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Caso/Proyecto</th>
                <th>Tipo</th>
                {!isClientInmobiliaria ? <th>Estado financiero</th> : null}
                {!isClientInmobiliaria ? <th>Aprobado</th> : null}
                {!isClientInmobiliaria ? <th>Facturado</th> : null}
                {!isClientInmobiliaria ? <th>Cobrado</th> : null}
                {!isClientInmobiliaria ? <th>Saldo cobrar</th> : null}
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
                  {!isClientInmobiliaria ? <td>{row.estado_financiero}</td> : null}
                  {!isClientInmobiliaria ? <td>{Number(row.valor_aprobado).toLocaleString("es-CO")}</td> : null}
                  {!isClientInmobiliaria ? <td>{Number(row.valor_facturado).toLocaleString("es-CO")}</td> : null}
                  {!isClientInmobiliaria ? <td>{Number(row.valor_cobrado).toLocaleString("es-CO")}</td> : null}
                  {!isClientInmobiliaria ? <td>{Number(row.saldo_por_cobrar).toLocaleString("es-CO")}</td> : null}
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
