import Link from "next/link";

import { getCurrentUserPermissions, requirePagePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

interface CasosPageProps {
  searchParams: Promise<{ estado_financiero?: string; tipo?: string }>;
}

type CaseRow = {
  id: string;
  case_code?: string | null;
  flow_type?: string | null;
  service_area?: string | null;
  status?: string | null;
  current_stage?: string | null;
  internal_client_code?: string | null;
  external_property_code?: string | null;
  external_case_id?: string | null;
  external_case_code?: string | null;
  client_id?: string | null;
  created_at?: string | null;
  clients?: { name?: string | null } | { name?: string | null }[] | null;
};

type FinancialRow = {
  id: string;
  case_type?: string | null;
  estado_financiero?: string | null;
  valor_aprobado?: number | null;
  valor_facturado?: number | null;
  valor_cobrado?: number | null;
  saldo_por_cobrar?: number | null;
  requerimiento_id?: string | null;
  technical_project_id?: string | null;
  requerimientos?: { cliente_id?: string | null; codigo_requerimiento?: string | null } | null;
  technical_projects?: { client_id?: string | null; name?: string | null } | null;
};

function money(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("es-CO");
}

function clientName(row: CaseRow) {
  const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  return client?.name ?? "-";
}

function caseLabel(row: CaseRow) {
  return (
    row.case_code ??
    row.external_case_id ??
    row.external_case_code ??
    row.internal_client_code ??
    row.external_property_code ??
    `Caso ${row.id.slice(0, 8)}`
  );
}

export default async function CasosPage({ searchParams }: CasosPageProps) {
  const permissionContext = await getCurrentUserPermissions();
  const isClientInmobiliaria = permissionContext.normalizedRole === "cliente_inmobiliaria";
  const missingClientAssociation = isClientInmobiliaria && !permissionContext.clientId;

  if (permissionContext.permissions.includes("ver_casos")) {
    await requirePagePermission("ver_casos", "/dashboard", "Acceso denegado: tu rol no puede ver casos.");
  } else if (permissionContext.permissions.includes("ver_casos_cliente")) {
    await requirePagePermission("ver_casos_cliente", "/dashboard", "Acceso denegado: tu rol no puede ver casos de inmobiliaria.");
  } else {
    await requirePagePermission("ver_casos_propios", "/dashboard", "Acceso denegado: solo puedes ver casos propios.");
  }

  const params = await searchParams;
  const supabase = createAdminClient() as any;

  let casesQuery = supabase
    .from("cases")
    .select(
      "id, case_code, flow_type, service_area, status, current_stage, internal_client_code, external_property_code, external_case_id, external_case_code, client_id, created_at, clients!cases_client_id_fkey(name)"
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (params.tipo) {
    casesQuery = casesQuery.eq("flow_type", params.tipo);
  }

  const financialQuery = supabase
    .from("financial_records")
    .select(
      "id, case_type, estado_financiero, valor_aprobado, valor_facturado, valor_cobrado, saldo_por_cobrar, requerimiento_id, technical_project_id, requerimientos(cliente_id, codigo_requerimiento), technical_projects(client_id, name)"
    )
    .order("updated_at", { ascending: false })
    .limit(300);

  const [casesResp, financialResp] = await Promise.all([casesQuery, financialQuery]);
  let caseRows = ((casesResp.data ?? []) as CaseRow[]) || [];
  let financialRows = ((financialResp.data ?? []) as FinancialRow[]) || [];

  if (params.estado_financiero) {
    financialRows = financialRows.filter((row) => row.estado_financiero === params.estado_financiero);
  }

  if (isClientInmobiliaria) {
    const clientId = permissionContext.clientId;
    if (!clientId) {
      caseRows = [];
      financialRows = [];
    } else {
      caseRows = caseRows.filter((row) => row.client_id === clientId);
      financialRows = financialRows.filter((row) => {
        const reqClientId = row.requerimientos?.cliente_id ?? null;
        const projectClientId = row.technical_projects?.client_id ?? null;
        return reqClientId === clientId || projectClientId === clientId;
      });
    }
  } else if (!permissionContext.permissions.includes("ver_casos") && permissionContext.userId) {
    const tecnicoId = permissionContext.userId;
    const [agendasPropiasResp, tareasProyectoResp] = await Promise.all([
      supabase.from("agenda_operativa").select("requerimiento_id").eq("tecnico_id", tecnicoId),
      supabase.from("technical_project_tasks").select("project_id").eq("responsible_user_id", tecnicoId)
    ]);

    const requerimientoIds = new Set((agendasPropiasResp.data ?? []).map((row: { requerimiento_id: string | null }) => row.requerimiento_id));
    const projectIds = new Set((tareasProyectoResp.data ?? []).map((row: { project_id: string | null }) => row.project_id));

    caseRows = [];
    financialRows = financialRows.filter(
      (row) =>
        (row.requerimiento_id && requerimientoIds.has(row.requerimiento_id)) ||
        (row.technical_project_id && projectIds.has(row.technical_project_id))
    );
  }

  const hasRows = caseRows.length > 0 || financialRows.length > 0;

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Casos / Proyectos consolidados</h1>
          <p>Vista unificada para seguimiento operativo, comercial y financiero.</p>
        </div>
        <div className="inline-form">
          {!isClientInmobiliaria ? <Link href="/dashboard/casos/nuevo">Crear caso</Link> : null}
          <Link href="/dashboard">Volver</Link>
        </div>
      </div>

      {casesResp.error ? (
        <p className="feedback error">No se pudieron cargar casos operativos: {casesResp.error.message}</p>
      ) : null}
      {financialResp.error ? (
        <p className="feedback error">No se pudieron cargar registros financieros: {financialResp.error.message}</p>
      ) : null}

      <section className="card">
        <h2>Filtros</h2>
        <form method="GET" className="inline-form">
          <select name="tipo" defaultValue={params.tipo ?? ""}>
            <option value="">Todos los tipos</option>
            <option value="mantenimiento">mantenimiento</option>
            <option value="reparacion">reparacion</option>
            <option value="consultoria">consultoria</option>
            <option value="interventoria">interventoria</option>
            <option value="obra_conjunto_residencial">obra_conjunto_residencial</option>
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
        {!hasRows ? <p className="feedback">Aún no hay casos para mostrar con estos filtros.</p> : null}
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Caso/Proyecto</th>
                <th>Cliente</th>
                <th>Referencia cliente</th>
                <th>Tipo</th>
                <th>Estado</th>
                {!isClientInmobiliaria ? <th>Estado financiero</th> : null}
                {!isClientInmobiliaria ? <th>Aprobado</th> : null}
                {!isClientInmobiliaria ? <th>Facturado</th> : null}
                {!isClientInmobiliaria ? <th>Cobrado</th> : null}
                {!isClientInmobiliaria ? <th>Saldo cobrar</th> : null}
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {caseRows.map((row) => (
                <tr key={`case-${row.id}`}>
                  <td>{caseLabel(row)}</td>
                  <td>{clientName(row)}</td>
                  <td>
                    {[row.internal_client_code, row.external_property_code, row.external_case_id, row.external_case_code]
                      .filter(Boolean)
                      .join(" | ") || "-"}
                  </td>
                  <td>{row.flow_type ?? "-"}</td>
                  <td>{row.status ?? row.current_stage ?? "-"}</td>
                  {!isClientInmobiliaria ? <td>sin_cotizacion</td> : null}
                  {!isClientInmobiliaria ? <td>0</td> : null}
                  {!isClientInmobiliaria ? <td>0</td> : null}
                  {!isClientInmobiliaria ? <td>0</td> : null}
                  {!isClientInmobiliaria ? <td>0</td> : null}
                  <td>
                    <Link href={`/dashboard/casos/${row.id}`}>Abrir vista única</Link>
                  </td>
                </tr>
              ))}
              {financialRows.map((row) => (
                <tr key={`financial-${row.id}`}>
                  <td>{row.requerimientos?.codigo_requerimiento ?? row.technical_projects?.name ?? "-"}</td>
                  <td>-</td>
                  <td>-</td>
                  <td>{row.case_type}</td>
                  <td>-</td>
                  {!isClientInmobiliaria ? <td>{row.estado_financiero}</td> : null}
                  {!isClientInmobiliaria ? <td>{money(row.valor_aprobado)}</td> : null}
                  {!isClientInmobiliaria ? <td>{money(row.valor_facturado)}</td> : null}
                  {!isClientInmobiliaria ? <td>{money(row.valor_cobrado)}</td> : null}
                  {!isClientInmobiliaria ? <td>{money(row.saldo_por_cobrar)}</td> : null}
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
