import Link from "next/link";

import { getCurrentUserPermissions, requirePagePermission } from "@/lib/auth/permissions";
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
  const permissionContext = await getCurrentUserPermissions();
  const isClientInmobiliaria = permissionContext.normalizedRole === "cliente_inmobiliaria";
  const canEditCases = !isClientInmobiliaria;
  if (permissionContext.permissions.includes("ver_casos")) {
    await requirePagePermission("ver_casos", "/dashboard", "Acceso denegado para ver el expediente.");
  } else if (permissionContext.permissions.includes("ver_detalle_caso_cliente")) {
    await requirePagePermission("ver_detalle_caso_cliente", "/dashboard", "Acceso denegado para ver el expediente.");
  } else {
    await requirePagePermission("ver_casos_propios", "/dashboard", "Acceso denegado: solo puedes ver casos propios.");
  }

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
    const caseResp = await supabase
      .from("cases")
      .select(
        "id, case_code, title, description, status, priority, flow_type, service_area, current_stage, internal_client_code, external_property_code, external_case_id, external_case_code, bill_to_assigned_client, billing_observations, created_at, updated_at, client_id, clients!cases_client_id_fkey(id, name, client_type)"
      )
      .eq("id", id)
      .maybeSingle();

    if (!caseResp.data) {
      return (
        <main>
          <p className="feedback error">No se encontró el caso/proyecto consolidado.</p>
          <Link href="/dashboard/casos">Volver a casos</Link>
        </main>
      );
    }

    const caseData = caseResp.data as any;
    const caseClient = Array.isArray(caseData.clients) ? caseData.clients[0] : caseData.clients;

    if (isClientInmobiliaria) {
      const profileClientId = permissionContext.clientId;
      if (!profileClientId || caseData.client_id !== profileClientId) {
        return (
          <main>
            <p className="feedback error">Acceso denegado: este caso no pertenece a tu inmobiliaria.</p>
            <Link href="/dashboard/casos">Volver a casos</Link>
          </main>
        );
      }
    }

    const docsResp = await supabase
      .from("case_documents")
      .select("id, document_type, name, original_filename, file_url, created_at")
      .eq("case_id", id)
      .order("created_at", { ascending: false });

    const docs = (docsResp.data ?? []) as any[];
    const caseReference = [caseData.internal_client_code, caseData.external_property_code, caseData.external_case_id, caseData.external_case_code]
      .filter(Boolean)
      .join(" | ");

    return (
      <main>
        <div className="page-header">
          <div>
            <h1>Expediente único de caso</h1>
            <p>
              {caseData.case_code ?? `Caso ${id.slice(0, 8)}`} | Estado: <strong>{caseData.status ?? "-"}</strong>
            </p>
          </div>
          <div className="inline-form">
            <Link href="/dashboard/casos">Volver a casos</Link>
            {canEditCases ? <Link href={`/dashboard/casos/${caseData.id}/editar`}>Editar caso</Link> : null}
            {!isClientInmobiliaria ? <Link href="/dashboard/casos/nuevo">Crear otro caso</Link> : null}
          </div>
        </div>

        {docsResp.error ? <p className="feedback error">No se pudieron cargar documentos: {docsResp.error.message}</p> : null}

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Resumen</h2>
          <p>
            Cliente: <strong>{caseClient?.name ?? "-"}</strong>
            {caseClient?.client_type ? ` (${caseClient.client_type})` : ""}
          </p>
          <p>
            Tipo: <strong>{caseData.flow_type ?? "-"}</strong> | Requerimiento: <strong>{caseData.service_area ?? "-"}</strong> |
            Prioridad: <strong>{caseData.priority ?? "-"}</strong>
          </p>
          <p>
            Referencia cliente: <strong>{caseReference || "-"}</strong>
          </p>
          <p>
            Etapa operativa: <strong>{caseData.current_stage ?? "-"}</strong> | Creado:{" "}
            <strong>{dateTimeValue(caseData.created_at)}</strong>
          </p>
          <p>
            Facturación:{" "}
            <strong>{caseData.bill_to_assigned_client === false ? "Otro / por definir" : "Cliente asignado"}</strong>
            {caseData.billing_observations ? ` | ${caseData.billing_observations}` : ""}
          </p>
        </section>

        <section className="card" id="diagnostico">
          <h2>Descripción / diagnóstico inicial</h2>
          <p>{caseData.description ?? "Sin descripción registrada."}</p>
        </section>

        <section className="card" id="fotos-documentos">
          <h2>Fotos / documentos</h2>
          {docs.length === 0 ? <p>No hay documentos adjuntos en este caso.</p> : null}
          {docs.length > 0 ? (
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
                  {docs.map((doc) => (
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

        <section className="card" id="financiero">
          <h2>Finanzas</h2>
          <p>Este caso todavía no tiene ficha financiera detallada. Estado comercial inicial: sin_cotizacion.</p>
        </section>
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
  const requestClientId = (reqResp.data as { clients?: { id?: string } | null } | null)?.clients?.id ?? null;
  const projectClientId = projectResp.data?.client_id ?? null;
  const projectType = projectResp.data?.type ?? null;
  const projectIsInterventoria = projectType === "interventoria" || projectType === "consultoria";

  if (isClientInmobiliaria) {
    const profileClientId = permissionContext.clientId;
    const belongsToClient = !!profileClientId && (requestClientId === profileClientId || projectClientId === profileClientId);
    if (!belongsToClient) {
      return (
        <main>
          <p className="feedback error">Acceso denegado: este caso no pertenece a tu inmobiliaria.</p>
          <Link href="/dashboard/casos">Volver a casos</Link>
        </main>
      );
    }
  }

  if (!permissionContext.permissions.includes("ver_casos") && permissionContext.userId) {
    const tecnicoId = permissionContext.userId;
    const [agendaPropiaResp, tareaPropiaResp] = await Promise.all([
      requestId
        ? supabase
            .from("agenda_operativa")
            .select("id")
            .eq("requerimiento_id", requestId)
            .eq("tecnico_id", tecnicoId)
            .limit(1)
        : Promise.resolve({ data: [] as Array<{ id: string }>, error: null }),
      projectId
        ? supabase
            .from("technical_project_tasks")
            .select("id")
            .eq("project_id", projectId)
            .eq("responsible_user_id", tecnicoId)
            .limit(1)
        : Promise.resolve({ data: [] as Array<{ id: string }>, error: null })
    ]);

    const isAssigned = (agendaPropiaResp.data?.length ?? 0) > 0 || (tareaPropiaResp.data?.length ?? 0) > 0;
    if (!isAssigned) {
      return (
        <main>
          <p className="feedback error">Acceso denegado: este caso no está asignado a tu usuario.</p>
          <Link href="/dashboard/casos">Volver a casos</Link>
        </main>
      );
    }
  }

  const [
    agendasResp,
    projectTasksResp,
    reqDocsResp,
    projectDocsResp,
    quotesResp,
    workOrdersResp,
    satisfactionActsResp,
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
            "id, fecha_programada, franja_horaria, tipo_visita, estado_agenda, direccion, contacto, observaciones_logisticas, profiles(full_name), reportes_visita(id, created_at, resultado_visita, hora_llegada, hora_salida, observaciones, diagnostico_tecnico, reporte_visita_fotos(id, storage_path, descripcion))"
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
    requestId
      ? supabase
          .from("work_orders")
          .select("id, codigo_orden, status, fecha_documento, scheduled_start")
          .eq("requerimiento_id", requestId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    requestId
      ? supabase
          .from("actas_satisfaccion")
          .select("id, codigo_acta, fecha_acta, satisfaccion, created_at")
          .eq("requerimiento_id", requestId)
          .order("created_at", { ascending: false })
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
  const ordenActual = (workOrdersResp.data ?? [])[0] as any | undefined;
  const actaActual = (satisfactionActsResp.data ?? [])[0] as any | undefined;
  const totalMateriales = (movementsResp.data ?? []).reduce((acc, row: any) => acc + Number(row.total_cost ?? 0), 0);
  const herramientasPendientes = (toolAssignmentsResp.data ?? []).filter((row: any) => !row.returned_at).length;
  const projectTaskProgress =
    projectTasks.length === 0 ? 0 : Math.round(projectTasks.reduce((acc, row) => acc + Number(row.progress_percent ?? 0), 0) / projectTasks.length);
  const reportes = agendas.flatMap((agenda) => (agenda.reportes_visita as any[] | null) ?? []);
  const diagnosticoBase =
    reportes.find((reporte) => reporte.diagnostico_tecnico)?.diagnostico_tecnico ??
    reportes.find((reporte) => reporte.observaciones)?.observaciones ??
    (reqResp.data as any)?.descripcion ??
    projectResp.data?.description ??
    "Sin diagnóstico registrado.";
  const fotosVisita = reportes
    .flatMap((reporte) => (reporte.reporte_visita_fotos as any[] | null) ?? [])
    .map((foto) => ({
      ...foto,
      url: foto.storage_path
        ? supabase.storage.from("evidences").getPublicUrl(foto.storage_path).data.publicUrl
        : null
    }));

  const historial = [
    { fecha: financial.created_at, etiqueta: "Caso/proyecto creado", detalle: `Tipo ${financial.case_type}` },
    ...agendas.map((agenda) => ({
      fecha: agenda.fecha_programada,
      etiqueta: "Visita programada",
      detalle: `${agenda.tipo_visita} (${agenda.estado_agenda})`
    })),
    ...reportes.map((reporte) => ({
      fecha: reporte.hora_llegada ?? reporte.created_at,
      etiqueta: "Reporte de visita",
      detalle: reporte.resultado_visita ?? "Reporte técnico"
    })),
    ...((quotesResp.data ?? []) as any[]).map((row) => ({
      fecha: row.fecha_cotizacion,
      etiqueta: "Cotización",
      detalle: `${row.codigo_cotizacion} (${row.estado})`
    })),
    ...((workOrdersResp.data ?? []) as any[]).map((row) => ({
      fecha: row.fecha_documento,
      etiqueta: "Orden de trabajo",
      detalle: `${row.codigo_orden ?? row.id} (${row.status})`
    })),
    ...((satisfactionActsResp.data ?? []) as any[]).map((row) => ({
      fecha: row.fecha_acta ?? row.created_at,
      etiqueta: "Acta de satisfacción",
      detalle: `${row.codigo_acta ?? row.id} (${row.satisfaccion})`
    })),
    ...((invoicesResp.data ?? []) as any[]).map((row) => ({
      fecha: row.issued_at,
      etiqueta: "Factura",
      detalle: `${row.invoice_number} (${row.status})`
    }))
  ]
    .filter((item) => item.fecha)
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

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
          <h1>Expediente único de caso/proyecto</h1>
          <p>
            {caseLabel} | Estado financiero: <strong>{financial.estado_financiero}</strong>
          </p>
        </div>
        <div className="inline-form">
          <Link href={permissionContext.permissions.includes("ver_finanzas") ? "/dashboard/finanzas" : "/dashboard/casos"}>
            {permissionContext.permissions.includes("ver_finanzas") ? "Volver a finanzas" : "Volver a casos"}
          </Link>
          {!isClientInmobiliaria && requestId ? <Link href={`/dashboard/requerimientos/${requestId}/recursos`}>Recursos caso</Link> : null}
          {!isClientInmobiliaria && projectId ? <Link href={`/dashboard/proyectos-tecnicos/${projectId}`}>Proyecto técnico</Link> : null}
        </div>
      </div>

      {query.error ? <p className="feedback error">{query.error}</p> : null}
      {query.ok ? <p className="feedback success">{query.ok}</p> : null}

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Encabezado</h2>
        <p>
          Cliente: <strong>{clientLabel}</strong> | Inmueble/ubicación: <strong>{inmuebleUbicacion}</strong>
        </p>
        <p>
          Tipo: <strong>{financial.case_type}</strong> | Estado: <strong>{(reqResp.data as any)?.estado ?? projectResp.data?.status ?? "-"}</strong> |
          Responsable:{" "}
          <strong>
            {(projectTasks.find((task) => task.priority === "alta")?.profiles as { full_name?: string } | null)?.full_name ??
              (projectTasks.find((task) => task.profiles)?.profiles as { full_name?: string } | null)?.full_name ??
              (agendas.find((agenda) => agenda.profiles)?.profiles as { full_name?: string } | null)?.full_name ??
              "-"}
          </strong>{" "}
          | Prioridad: <strong>{(reqResp.data as any)?.prioridad ?? projectResp.data?.priority ?? "-"}</strong>
        </p>
        <p>
          Fechas: inicio/reporte {dateValue((reqResp.data as any)?.fecha_reporte ?? projectResp.data?.start_date)} | fin planeado{" "}
          {dateValue(projectResp.data?.planned_end_date)} | fin real {dateValue(projectResp.data?.actual_end_date)}
        </p>
      </section>

      <section className="card">
        <div className="inline-form">
          <a href="#resumen">Resumen</a>
          <a href="#diagnostico">Diagnóstico</a>
          <a href="#agenda">Agenda/visitas</a>
          <a href="#fotos-documentos">Fotos/documentos</a>
          <a href="#cotizacion">Cotización</a>
          <a href="#orden">Orden de trabajo</a>
          <a href="#acta">Acta</a>
          {!isClientInmobiliaria ? <a href="#financiero">Financiero</a> : null}
          <a href="#historial">Historial</a>
        </div>
      </section>

      <section className="card" id="resumen">
        <h2>Resumen</h2>
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
          Documentos asociados: {allDocs.length} | Visitas: {agendas.length} | Tareas: {tareasMostradas.length}
        </p>
      </section>

      <section className="card" id="diagnostico">
        <h2>Diagnóstico</h2>
        <p>{diagnosticoBase}</p>
      </section>

      <section className="card" id="agenda">
        <h2>Agenda / visitas</h2>
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

      <section className="card" id="fotos-documentos">
        <h2>Fotos / documentos</h2>
        <p>
          Fotos de visita: {fotosVisita.length} | Documentos adjuntos: {allDocs.length}
        </p>
        {fotosVisita.length > 0 ? (
          <div className="photo-grid">
            {fotosVisita.slice(0, 8).map((foto: any) => (
              <article key={foto.id} className="photo-card">
                <img src={foto.url ?? ""} alt="Foto visita" />
                <small>{foto.descripcion ?? "Evidencia de visita"}</small>
              </article>
            ))}
          </div>
        ) : null}

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

      <section className="card" id="cotizacion">
        <h2>Cotización</h2>
        {cotizacionActual ? (
          <p>
            Cotización: <strong>{cotizacionActual.codigo_cotizacion}</strong> | Estado: {cotizacionActual.estado} | Valor:{" "}
            {money(cotizacionActual.total_final)} | Fecha: {dateValue(cotizacionActual.fecha_cotizacion)}
            {!isClientInmobiliaria ? (
              <>
                {" "}
                | <Link href={`/dashboard/cotizaciones/${cotizacionActual.id}`}>Abrir cotización</Link>
              </>
            ) : null}
          </p>
        ) : (
          <p>No hay cotización asociada al caso por ahora.</p>
        )}
      </section>

      <section className="card" id="orden">
        <h2>Orden de trabajo</h2>
        {ordenActual ? (
          <p>
            Orden: <strong>{ordenActual.codigo_orden ?? ordenActual.id}</strong> | Estado: {ordenActual.status} | Fecha:{" "}
            {dateValue(ordenActual.fecha_documento)}
            {!isClientInmobiliaria ? (
              <>
                {" "}
                | <Link href={`/dashboard/ordenes-trabajo/${ordenActual.id}`}>Abrir orden</Link>
              </>
            ) : null}
          </p>
        ) : (
          <p>No hay orden de trabajo asociada al caso.</p>
        )}
      </section>

      <section className="card" id="acta">
        <h2>Acta</h2>
        {actaActual ? (
          <p>
            Acta: <strong>{actaActual.codigo_acta ?? actaActual.id}</strong> | Satisfacción: {actaActual.satisfaccion} | Fecha:{" "}
            {dateValue(actaActual.fecha_acta)}
            {!isClientInmobiliaria ? (
              <>
                {" "}
                | <Link href={`/dashboard/actas-satisfaccion/${actaActual.id}`}>Abrir acta</Link>
              </>
            ) : null}
          </p>
        ) : (
          <p>No hay acta de satisfacción asociada al caso.</p>
        )}
      </section>

      {!isClientInmobiliaria ? (
        <section className="card" id="financiero">
          <h2>Finanzas</h2>
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
      ) : null}

      <section className="card" id="historial">
        <h2>Historial</h2>
        <p>
          Tareas: {tareasMostradas.length} | Avance promedio: {projectTaskProgress}%
          {!isClientInmobiliaria ? (
            <>
              {" "}
              | Materiales: {(movementsResp.data ?? []).length} ({money(totalMateriales)}) | Herramientas pendientes: {herramientasPendientes}
            </>
          ) : null}
        </p>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Evento</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((item, index) => (
                <tr key={`hist-${index}`}>
                  <td>{dateValue(item.fecha)}</td>
                  <td>{item.etiqueta}</td>
                  <td>{item.detalle}</td>
                </tr>
              ))}
              {historial.length === 0 ? (
                <tr>
                  <td colSpan={3}>Sin historial registrado.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {projectIsInterventoria && projectId && !isClientInmobiliaria ? (
          <div className="inline-form" style={{ marginTop: "0.75rem" }}>
            <Link href={`/dashboard/proyectos-tecnicos/${projectId}/interventoria`}>Interventoría</Link>
            <Link href={`/dashboard/proyectos-tecnicos/${projectId}/gantt`}>Gantt</Link>
            <Link href={`/dashboard/proyectos-tecnicos/${projectId}/seguimientos`}>Seguimientos</Link>
            <Link href={`/dashboard/proyectos-tecnicos/${projectId}/entregables`}>Entregables</Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
