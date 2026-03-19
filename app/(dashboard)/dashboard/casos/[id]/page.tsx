import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

interface CasoDetallePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}

function money(value: number | null | undefined) {
  return (Number(value ?? 0) || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  });
}

function dateValue(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("es-CO") : "-";
}

function dateTimeValue(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("es-CO") : "-";
}

export default async function CasoDetallePage({ params, searchParams }: CasoDetallePageProps) {
  await requirePageAccess(
    ["administrador", "asistente", "contabilidad", "tecnico"],
    "/dashboard",
    "Acceso denegado: tu rol no puede acceder a la vista consolidada del caso."
  );

  const { id } = await params;
  const query = await searchParams;
  const supabase = createAdminClient();

  const financialResp = await supabase
    .from("financial_records")
    .select(
      "id, case_type, requerimiento_id, technical_project_id, valor_cotizado, valor_aprobado, requiere_anticipo, porcentaje_anticipo, valor_anticipo_solicitado, valor_anticipo_recibido, fecha_solicitud_anticipo, fecha_recepcion_anticipo, valor_facturado, valor_cobrado, saldo_por_facturar, saldo_por_cobrar, costo_total_asociado, utilidad_estimada, utilidad_real, estado_financiero, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!financialResp.data) {
    return (
      <main>
        <p className="feedback error">No se encontró el caso/proyecto consolidado.</p>
        <Link href="/dashboard/finanzas">Volver a finanzas</Link>
      </main>
    );
  }

  const financial = financialResp.data;
  const baseRequestId = financial.requerimiento_id;
  const projectId = financial.technical_project_id;

  const [reqResp, projectResp] = await Promise.all([
    baseRequestId
      ? supabase
          .from("requerimientos")
          .select(
            "id, codigo_requerimiento, descripcion, estado, prioridad, fecha_reporte, tipo_servicio, contacto_nombre, contacto_telefono, canal_ingreso, observaciones_internas, clients(id, name), properties(id, name, address, city)"
          )
          .eq("id", baseRequestId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    projectId
      ? supabase
          .from("technical_projects")
          .select(
            "id, name, type, description, location, status, priority, start_date, planned_end_date, actual_end_date, linked_request_id, client_id, director_responsible_id, technical_lead_id, clients(id, name)"
          )
          .eq("id", projectId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  const requestId = reqResp.data?.id ?? projectResp.data?.linked_request_id ?? null;
  const projectType = projectResp.data?.type ?? null;
  const projectIsInterventoria = projectType === "interventoria" || projectType === "consultoria";

  const [
    agendasResp,
    projectTasksResp,
    reqDocsResp,
    projectDocsResp,
    quotesResp,
    invoicesResp,
    advancesResp,
    movementsResp,
    toolAssignmentsResp,
    interventoriaVisitsResp,
    interventoriaQualityResp,
    interventoriaSstResp,
    interventoriaActasResp,
    interventoriaReqResp
  ] = await Promise.all([
    requestId
      ? supabase
          .from("agenda_operativa")
          .select(
            "id, fecha_programada, franja_horaria, tipo_visita, estado_agenda, direccion, contacto, observaciones_logisticas, profiles(full_name), reportes_visita(id, resultado_visita, hora_llegada, hora_salida, observaciones)"
          )
          .eq("requerimiento_id", requestId)
          .order("fecha_programada", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    projectId
      ? supabase
          .from("technical_project_tasks")
          .select(
            "id, task_type, name, status, priority, progress_percent, planned_end_date, start_date, scheduled_time, notes, profiles(full_name)"
          )
          .eq("project_id", projectId)
          .order("planned_end_date", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    requestId
      ? supabase
          .from("requerimiento_documents")
          .select("id, document_type, name, original_filename, file_url, created_at")
          .eq("requerimiento_id", requestId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    projectId
      ? supabase
          .from("technical_project_documents")
          .select("id, document_type, name, original_filename, file_url, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    requestId
      ? supabase
          .from("cotizaciones")
          .select("id, codigo_cotizacion, estado, fecha_cotizacion, total_final")
          .eq("requerimiento_id", requestId)
          .order("fecha_cotizacion", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("invoices")
      .select("id, invoice_number, issued_at, due_at, amount_total, amount_pending, status")
      .eq("financial_record_id", id)
      .order("issued_at", { ascending: false }),
    supabase
      .from("advance_requests")
      .select("id, requested_at, status, percentage, amount_requested, amount_received, received_at")
      .eq("financial_record_id", id)
      .order("requested_at", { ascending: false }),
    requestId
      ? supabase
          .from("inventory_movements")
          .select("id, movement_type, quantity, total_cost, created_at, inventory_items(name, unit)")
          .eq("case_id", requestId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    requestId
      ? supabase
          .from("tool_assignments")
          .select("id, status, assigned_at, returned_at, tools(name, code), profiles(full_name)")
          .eq("case_id", requestId)
          .order("assigned_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    projectId && projectIsInterventoria
      ? supabase
          .from("interventoria_site_visits")
          .select("id, visit_date, progress_percent")
          .eq("project_id", projectId)
      : Promise.resolve({ data: [], error: null }),
    projectId && projectIsInterventoria
      ? supabase.from("interventoria_quality_records").select("id, status").eq("project_id", projectId)
      : Promise.resolve({ data: [], error: null }),
    projectId && projectIsInterventoria
      ? supabase.from("interventoria_sst_records").select("id, status").eq("project_id", projectId)
      : Promise.resolve({ data: [], error: null }),
    projectId && projectIsInterventoria
      ? supabase.from("interventoria_actas").select("id, acta_type, status").eq("project_id", projectId)
      : Promise.resolve({ data: [], error: null }),
    projectId && projectIsInterventoria
      ? supabase.from("interventoria_contractor_requirements").select("id, status").eq("project_id", projectId)
      : Promise.resolve({ data: [], error: null })
  ]);

  const agendas = (agendasResp.data ?? []) as any[];
  const projectTasks = (projectTasksResp.data ?? []) as any[];
  const allDocs = [...(reqDocsResp.data ?? []), ...(projectDocsResp.data ?? [])];
  const visitasProgramadas = agendas.filter((agenda) => agenda.estado_agenda !== "cerrada");
  const visitasRealizadas = agendas.filter((agenda) => agenda.estado_agenda === "cerrada");
  const tareasMostradas = projectTasks.length > 0 ? projectTasks : agendas;
  const cotizacionActual = (quotesResp.data ?? [])[0] as any | undefined;
  const totalMateriales = (movementsResp.data ?? []).reduce((acc, row: any) => acc + Number(row.total_cost ?? 0), 0);
  const herramientasPendientes = (toolAssignmentsResp.data ?? []).filter((row: any) => !row.returned_at).length;
  const projectTaskProgress =
    projectTasks.length === 0 ? 0 : Math.round(projectTasks.reduce((acc, row) => acc + Number(row.progress_percent ?? 0), 0) / projectTasks.length);

  const caseLabel =
    (reqResp.data as any)?.codigo_requerimiento ??
    (projectResp.data as any)?.name ??
    `Caso ${id.slice(0, 8)}`;
  const clientLabel =
    ((reqResp.data as any)?.clients as { name?: string } | null)?.name ??
    ((projectResp.data as any)?.clients as { name?: string } | null)?.name ??
    "-";
  const inmuebleUbicacion =
    ((reqResp.data as any)?.properties as { name?: string; address?: string; city?: string } | null)?.name ??
    ((reqResp.data as any)?.properties as { name?: string; address?: string; city?: string } | null)?.address ??
    projectResp.data?.location ??
    "-";

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Vista única del caso/proyecto</h1>
          <p>
            {caseLabel} | Estado financiero: <strong>{financial.estado_financiero}</strong>
          </p>
        </div>
        <div className="inline-form">
          <Link href="/dashboard/finanzas">Volver a finanzas</Link>
          {requestId ? <Link href={`/dashboard/requerimientos/${requestId}/recursos`}>Recursos caso</Link> : null}
          {projectId ? <Link href={`/dashboard/proyectos-tecnicos/${projectId}`}>Proyecto técnico</Link> : null}
        </div>
      </div>

      {query.error ? <p className="feedback error">{query.error}</p> : null}
      {query.ok ? <p className="feedback success">{query.ok}</p> : null}

      <section className="card">
        <div className="inline-form">
          <a href="#resumen">Resumen</a>
          <a href="#documentos">Documentos</a>
          <a href="#agenda">Agenda/visitas</a>
          <a href="#tareas">Tareas</a>
          <a href="#comercial">Cotización/comercial</a>
          <a href="#financiero">Financiero</a>
          <a href="#recursos">Recursos</a>
          {projectIsInterventoria ? <a href="#interventoria">Interventoría/consultoría</a> : null}
        </div>
      </section>

      <section className="card" id="resumen">
        <h2>A. Resumen</h2>
        <p>Tipo de caso/proyecto: {financial.case_type}</p>
        <p>Cliente: {clientLabel}</p>
        <p>Inmueble/ubicación: {inmuebleUbicacion}</p>
        <p>
          Estado operativo: {(reqResp.data as any)?.estado ?? projectResp.data?.status ?? "-"} | Prioridad:{" "}
          {(reqResp.data as any)?.prioridad ?? projectResp.data?.priority ?? "-"}
        </p>
        <p>
          Responsable principal:{" "}
          {(projectTasks.find((task) => task.priority === "alta")?.profiles as { full_name?: string } | null)?.full_name ??
            (projectTasks.find((task) => task.profiles)?.profiles as { full_name?: string } | null)?.full_name ??
            (agendas.find((agenda) => agenda.profiles)?.profiles as { full_name?: string } | null)?.full_name ??
            "-"}
        </p>
        <p>
          Fechas clave: reporte/inicio {dateValue((reqResp.data as any)?.fecha_reporte ?? projectResp.data?.start_date)} | fin planeado{" "}
          {dateValue(projectResp.data?.planned_end_date)} | fin real {dateValue(projectResp.data?.actual_end_date)}
        </p>
      </section>

      <section className="card" id="documentos">
        <h2>B. Documentos</h2>
        {allDocs.length === 0 ? <p>No hay documentos adjuntos en el caso/proyecto.</p> : null}
        {allDocs.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Nombre</th>
                  <th>Archivo</th>
                </tr>
              </thead>
              <tbody>
                {allDocs.map((doc: any) => (
                  <tr key={doc.id}>
                    <td>{dateTimeValue(doc.created_at)}</td>
                    <td>{doc.document_type}</td>
                    <td>{doc.name}</td>
                    <td>{doc.file_url ? <a href={doc.file_url}>{doc.original_filename}</a> : doc.original_filename}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="card" id="agenda">
        <h2>C. Agenda / visitas</h2>
        <p>
          Programadas: {visitasProgramadas.length} | Realizadas: {visitasRealizadas.length}
        </p>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Tipo</th>
                <th>Responsable</th>
                <th>Estado</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {agendas.map((agenda) => (
                <tr key={agenda.id}>
                  <td>{agenda.fecha_programada}</td>
                  <td>{agenda.franja_horaria}</td>
                  <td>{agenda.tipo_visita}</td>
                  <td>{(agenda.profiles as { full_name?: string } | null)?.full_name ?? "-"}</td>
                  <td>{agenda.estado_agenda}</td>
                  <td>{agenda.observaciones_logisticas ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" id="tareas">
        <h2>D. Tareas</h2>
        <p>
          Total: {tareasMostradas.length} | Avance promedio: {projectTaskProgress}%
        </p>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tarea</th>
                <th>Responsable</th>
                <th>Fecha límite</th>
                <th>Estado</th>
                <th>Prioridad</th>
                <th>% avance</th>
              </tr>
            </thead>
            <tbody>
              {projectTasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.name}</td>
                  <td>{(task.profiles as { full_name?: string } | null)?.full_name ?? "-"}</td>
                  <td>{task.planned_end_date ?? "-"}</td>
                  <td>{task.status}</td>
                  <td>{task.priority}</td>
                  <td>{Number(task.progress_percent ?? 0)}%</td>
                </tr>
              ))}
              {projectTasks.length === 0
                ? agendas.map((agenda) => (
                    <tr key={agenda.id}>
                      <td>{agenda.tipo_visita}</td>
                      <td>{(agenda.profiles as { full_name?: string } | null)?.full_name ?? "-"}</td>
                      <td>{agenda.fecha_programada}</td>
                      <td>{agenda.estado_agenda}</td>
                      <td>-</td>
                      <td>{agenda.estado_agenda === "cerrada" ? "100" : "0"}%</td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" id="comercial">
        <h2>E. Cotización / comercial</h2>
        {cotizacionActual ? (
          <p>
            Cotización: <strong>{cotizacionActual.codigo_cotizacion}</strong> | Estado: {cotizacionActual.estado} | Valor:{" "}
            {money(cotizacionActual.total_final)} | Fecha: {dateValue(cotizacionActual.fecha_cotizacion)} |{" "}
            <Link href={`/dashboard/cotizaciones/${cotizacionActual.id}`}>Abrir cotización</Link>
          </p>
        ) : (
          <p>No hay cotización asociada al caso por ahora.</p>
        )}
      </section>

      <section className="card" id="financiero">
        <h2>F. Financiero</h2>
        <div className="metrics-grid">
          <article className="card metric-card">
            <p className="metric-label">Cotizado</p>
            <p className="metric-value">{money(financial.valor_cotizado)}</p>
          </article>
          <article className="card metric-card">
            <p className="metric-label">Aprobado</p>
            <p className="metric-value">{money(financial.valor_aprobado)}</p>
          </article>
          <article className="card metric-card">
            <p className="metric-label">Facturado</p>
            <p className="metric-value">{money(financial.valor_facturado)}</p>
          </article>
          <article className="card metric-card">
            <p className="metric-label">Cobrado</p>
            <p className="metric-value">{money(financial.valor_cobrado)}</p>
          </article>
          <article className="card metric-card">
            <p className="metric-label">Saldo por facturar</p>
            <p className="metric-value">{money(financial.saldo_por_facturar)}</p>
          </article>
          <article className="card metric-card">
            <p className="metric-label">Saldo por cobrar</p>
            <p className="metric-value">{money(financial.saldo_por_cobrar)}</p>
          </article>
        </div>
        <p>
          Anticipo solicitado: {money(financial.valor_anticipo_solicitado)} | Anticipo recibido: {money(financial.valor_anticipo_recibido)} |
          Solicitud: {dateValue(financial.fecha_solicitud_anticipo)} | Recepción: {dateValue(financial.fecha_recepcion_anticipo)}
        </p>
        <p>
          Utilidad estimada: {money(financial.utilidad_estimada)} | Utilidad real: {money(financial.utilidad_real)} | Estado financiero:{" "}
          {financial.estado_financiero}
        </p>
        <p>
          Facturas: {(invoicesResp.data ?? []).length} | Anticipos registrados: {(advancesResp.data ?? []).length} |{" "}
          <Link href="/dashboard/finanzas">Gestionar en finanzas</Link>
        </p>
      </section>

      <section className="card" id="recursos">
        <h2>G. Recursos</h2>
        <p>
          Materiales usados: {(movementsResp.data ?? []).length} movimientos ({money(totalMateriales)}) | Herramientas asignadas:{" "}
          {(toolAssignmentsResp.data ?? []).length} | Pendientes de devolución: {herramientasPendientes}
        </p>
        <div className="split-grid">
          <div>
            <h3>Materiales</h3>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Material</th>
                    <th>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {(movementsResp.data ?? []).slice(0, 10).map((row: any) => (
                    <tr key={row.id}>
                      <td>{dateTimeValue(row.created_at)}</td>
                      <td>{row.movement_type}</td>
                      <td>{(row.inventory_items as { name?: string } | null)?.name ?? "-"}</td>
                      <td>{Number(row.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h3>Herramientas</h3>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Herramienta</th>
                    <th>Responsable</th>
                    <th>Estado</th>
                    <th>Asignada</th>
                  </tr>
                </thead>
                <tbody>
                  {(toolAssignmentsResp.data ?? []).slice(0, 10).map((row: any) => (
                    <tr key={row.id}>
                      <td>
                        {(row.tools as { code?: string; name?: string } | null)?.code} -{" "}
                        {(row.tools as { code?: string; name?: string } | null)?.name}
                      </td>
                      <td>{(row.profiles as { full_name?: string } | null)?.full_name ?? "-"}</td>
                      <td>{row.status}</td>
                      <td>{dateTimeValue(row.assigned_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {projectIsInterventoria && projectId ? (
        <section className="card" id="interventoria">
          <h2>H. Interventoría / consultoría</h2>
          <p>
            Visitas: {(interventoriaVisitsResp.data ?? []).length} | Calidad: {(interventoriaQualityResp.data ?? []).length} | SST:{" "}
            {(interventoriaSstResp.data ?? []).length} | Actas: {(interventoriaActasResp.data ?? []).length} | Requerimientos a contratista:{" "}
            {(interventoriaReqResp.data ?? []).length}
          </p>
          <div className="inline-form">
            <Link href={`/dashboard/proyectos-tecnicos/${projectId}/interventoria`}>Abrir interventoría</Link>
            <Link href={`/dashboard/proyectos-tecnicos/${projectId}/gantt`}>Ver Gantt</Link>
            <Link href={`/dashboard/proyectos-tecnicos/${projectId}/seguimientos`}>Seguimientos</Link>
            <Link href={`/dashboard/proyectos-tecnicos/${projectId}/entregables`}>Entregables</Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
