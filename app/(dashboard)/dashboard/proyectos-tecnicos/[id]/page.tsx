import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  actualizarProyectoTecnicoAction,
  actualizarTareaProyectoAction,
  crearFaseProyectoAction,
  crearTareaProyectoAction,
  subirDocumentoProyectoAction
} from "../actions";

interface ProyectoDetallePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}

export default async function ProyectoDetallePage({ params, searchParams }: ProyectoDetallePageProps) {
  await requirePageAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede acceder a este proyecto."
  );

  const { id } = await params;
  const query = await searchParams;
  const supabase = createAdminClient();

  const [projectResp, phasesResp, tasksResp, usersResp, docsResp, financialResp] = await Promise.all([
    supabase
      .from("technical_projects")
      .select(
        "id, client_id, type, name, description, location, status, start_date, planned_end_date, actual_end_date, priority, director_responsible_id, technical_lead_id, linked_request_id, clients(name), requerimientos(codigo_requerimiento)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("technical_project_phases").select("id, name, phase_order, status, start_date, planned_end_date").eq("project_id", id).order("phase_order"),
    supabase
      .from("technical_project_tasks")
      .select("id, task_type, name, status, priority, progress_percent, responsible_user_id, phase_id, start_date, scheduled_time, planned_end_date, actual_end_date, notes, profiles(full_name)")
      .eq("project_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase
      .from("technical_project_documents")
      .select("id, document_type, name, file_url, original_filename, created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("financial_records")
      .select("id, estado_financiero, valor_aprobado, valor_facturado, valor_cobrado, saldo_por_cobrar")
      .eq("technical_project_id", id)
      .maybeSingle()
  ]);

  if (!projectResp.data) {
    return (
      <main>
        <p className="feedback error">Proyecto no encontrado.</p>
        <Link href="/dashboard/proyectos-tecnicos">Volver</Link>
      </main>
    );
  }

  const completedTasks = (tasksResp.data ?? []).filter((task) => task.status === "completada").length;
  const totalTasks = tasksResp.data?.length ?? 0;
  const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{projectResp.data.name}</h1>
          <p>
            Cliente: {(projectResp.data.clients as { name?: string } | null)?.name ?? "-"} | Tipo: {projectResp.data.type} |
            Estado: {projectResp.data.status}
          </p>
          <p>
            Caso ligado: {(projectResp.data.requerimientos as { codigo_requerimiento?: string } | null)?.codigo_requerimiento ?? "No ligado"}
          </p>
        </div>
        <div className="inline-form">
          <Link href="/dashboard/proyectos-tecnicos">Volver</Link>
          <Link href={`/dashboard/proyectos-tecnicos/${id}/gantt`}>Ver Gantt</Link>
          <Link href={`/dashboard/proyectos-tecnicos/${id}/presupuesto`}>Presupuesto obra</Link>
          <Link href={`/dashboard/proyectos-tecnicos/${id}/entregables`}>Entregables</Link>
          <Link href={`/dashboard/proyectos-tecnicos/${id}/seguimientos`}>Seguimientos</Link>
          <Link href={`/dashboard/proyectos-tecnicos/${id}/cantidades`}>Cantidades</Link>
          <Link href={`/dashboard/proyectos-tecnicos/${id}/interventoria`}>Interventoría</Link>
        </div>
      </div>

      {query.error ? <p className="feedback error">{query.error}</p> : null}
      {query.ok ? <p className="feedback success">{query.ok}</p> : null}

      <section className="card">
        <h2>Resumen</h2>
        <p>
          Tareas completadas: {completedTasks}/{totalTasks} ({progress}%)
        </p>
        {financialResp.data ? (
          <p>
            Financiero: {financialResp.data.estado_financiero} | Aprobado: {Number(financialResp.data.valor_aprobado).toLocaleString("es-CO")} |
            Facturado: {Number(financialResp.data.valor_facturado).toLocaleString("es-CO")} | Cobrado:{" "}
            {Number(financialResp.data.valor_cobrado).toLocaleString("es-CO")} | Saldo por cobrar:{" "}
            {Number(financialResp.data.saldo_por_cobrar).toLocaleString("es-CO")} |{" "}
            <Link href="/dashboard/finanzas">Ver ficha financiera</Link> |{" "}
            <Link href={`/dashboard/casos/${financialResp.data.id}`}>Vista única</Link>
          </p>
        ) : (
          <p className="feedback error">No existe ficha financiera para este proyecto. Ejecuta migraciones nuevas.</p>
        )}
      </section>

      <section className="card">
        <h2>Documentos del proyecto</h2>
        <form action={subirDocumentoProyectoAction} className="form-grid">
          <input type="hidden" name="return_path" value={`/dashboard/proyectos-tecnicos/${id}`} />
          <input type="hidden" name="project_id" value={id} />
          <select name="project_document_type">
            <option value="convocatoria">convocatoria</option>
            <option value="terminos_referencia">terminos_referencia</option>
            <option value="anexos">anexos</option>
            <option value="planos">planos</option>
            <option value="documento_cliente">documento_cliente</option>
            <option value="archivo_tecnico">archivo_tecnico</option>
            <option value="otro">otro</option>
          </select>
          <input name="project_document_name" placeholder="Nombre del documento (opcional)" />
          <label className="file-input-label span-2">
            Adjuntar archivos
            <input type="file" name="project_files" multiple />
          </label>
          <button type="submit">Subir documento(s)</button>
        </form>

        <div className="table-wrapper" style={{ marginTop: "1rem" }}>
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
              {docsResp.data?.map((doc) => (
                <tr key={doc.id}>
                  <td>{new Date(doc.created_at).toLocaleString("es-CO")}</td>
                  <td>{doc.document_type}</td>
                  <td>{doc.name}</td>
                  <td>{doc.file_url ? <a href={doc.file_url}>{doc.original_filename}</a> : doc.original_filename}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Editar proyecto</h2>
        <form action={actualizarProyectoTecnicoAction} className="form-grid">
          <input type="hidden" name="return_path" value={`/dashboard/proyectos-tecnicos/${id}`} />
          <input type="hidden" name="id" value={id} />
          <input name="name" defaultValue={projectResp.data.name} required />
          <input name="location" defaultValue={projectResp.data.location ?? ""} placeholder="Ubicación" />
          <select name="status" defaultValue={projectResp.data.status}>
            <option value="planeado">planeado</option>
            <option value="en_ejecucion">en_ejecucion</option>
            <option value="en_pausa">en_pausa</option>
            <option value="completado">completado</option>
            <option value="cancelado">cancelado</option>
          </select>
          <select name="priority" defaultValue={projectResp.data.priority}>
            <option value="baja">baja</option>
            <option value="media">media</option>
            <option value="alta">alta</option>
            <option value="critica">critica</option>
          </select>
          <input type="date" name="start_date" defaultValue={projectResp.data.start_date} />
          <input type="date" name="planned_end_date" defaultValue={projectResp.data.planned_end_date} />
          <input type="date" name="actual_end_date" defaultValue={projectResp.data.actual_end_date ?? ""} />
          <select name="director_responsible_id" defaultValue={projectResp.data.director_responsible_id ?? ""}>
            <option value="">Director responsable</option>
            {usersResp.data?.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name ?? user.id}
              </option>
            ))}
          </select>
          <select name="technical_lead_id" defaultValue={projectResp.data.technical_lead_id ?? ""}>
            <option value="">Líder técnico</option>
            {usersResp.data?.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name ?? user.id}
              </option>
            ))}
          </select>
          <textarea className="span-2" name="description" defaultValue={projectResp.data.description ?? ""} />
          <button type="submit">Guardar proyecto</button>
        </form>
      </section>

      <section className="card">
        <h2>Fases</h2>
        <form action={crearFaseProyectoAction} className="form-grid">
          <input type="hidden" name="return_path" value={`/dashboard/proyectos-tecnicos/${id}`} />
          <input type="hidden" name="project_id" value={id} />
          <input name="name" placeholder="Nombre fase" required />
          <input type="number" min="1" name="phase_order" defaultValue={1} />
          <select name="status" defaultValue="pendiente">
            <option value="pendiente">pendiente</option>
            <option value="en_progreso">en_progreso</option>
            <option value="completada">completada</option>
            <option value="bloqueada">bloqueada</option>
          </select>
          <input type="date" name="start_date" />
          <input type="date" name="planned_end_date" />
          <button type="submit">Agregar fase</button>
        </form>

        <div className="table-wrapper" style={{ marginTop: "1rem" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Fase</th>
                <th>Estado</th>
                <th>Inicio</th>
                <th>Fin plan</th>
              </tr>
            </thead>
            <tbody>
              {phasesResp.data?.map((phase) => (
                <tr key={phase.id}>
                  <td>{phase.phase_order}</td>
                  <td>{phase.name}</td>
                  <td>{phase.status}</td>
                  <td>{phase.start_date ?? "-"}</td>
                  <td>{phase.planned_end_date ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Tareas</h2>
        <form action={crearTareaProyectoAction} className="form-grid">
          <input type="hidden" name="return_path" value={`/dashboard/proyectos-tecnicos/${id}`} />
          <input type="hidden" name="project_id" value={id} />
          <input name="name" placeholder="Nombre tarea" required />
          <select name="task_type" defaultValue="otro">
            <option value="visita_tecnica">visita_tecnica</option>
            <option value="levantamiento_cantidades">levantamiento_cantidades</option>
            <option value="informe_tecnico">informe_tecnico</option>
            <option value="revision_documental">revision_documental</option>
            <option value="envio_cotizacion">envio_cotizacion</option>
            <option value="seguimiento">seguimiento</option>
            <option value="entrega_final">entrega_final</option>
            <option value="otro">otro</option>
          </select>
          <select name="phase_id">
            <option value="">Sin fase</option>
            {phasesResp.data?.map((phase) => (
              <option key={phase.id} value={phase.id}>
                {phase.phase_order}. {phase.name}
              </option>
            ))}
          </select>
          <select name="responsible_user_id">
            <option value="">Responsable</option>
            {usersResp.data?.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name ?? user.id}
              </option>
            ))}
          </select>
          <select name="status" defaultValue="pendiente">
            <option value="pendiente">pendiente</option>
            <option value="en_progreso">en_progreso</option>
            <option value="en_revision">en_revision</option>
            <option value="completada">completada</option>
            <option value="bloqueada">bloqueada</option>
          </select>
          <select name="priority" defaultValue="media">
            <option value="baja">baja</option>
            <option value="media">media</option>
            <option value="alta">alta</option>
            <option value="critica">critica</option>
          </select>
          <input type="date" name="start_date" />
          <input type="time" name="scheduled_time" />
          <input type="date" name="planned_end_date" />
          <input type="number" min="0" max="100" step="1" name="progress_percent" defaultValue={0} />
          <label className="checkbox-row">
            <input type="checkbox" name="alert_enabled" value="si" defaultChecked />
            Alertas activas
          </label>
          <textarea className="span-2" name="description" placeholder="Descripción tarea" />
          <textarea className="span-2" name="notes" placeholder="Notas internas" />
          <button type="submit">Crear tarea</button>
        </form>

        <h3 style={{ marginTop: "1rem" }}>Actualizar tareas</h3>
        <div className="activities-list">
          {tasksResp.data?.map((task) => (
            <article className="activity-item" key={task.id}>
              <p>
                <strong>{task.name}</strong> ({task.task_type}) | Responsable: {(task.profiles as { full_name?: string } | null)?.full_name ?? "-"}
              </p>
              <form action={actualizarTareaProyectoAction} className="form-grid">
                <input type="hidden" name="return_path" value={`/dashboard/proyectos-tecnicos/${id}`} />
                <input type="hidden" name="id" value={task.id} />
                <input type="hidden" name="project_id" value={id} />
                <select name="task_type" defaultValue={task.task_type}>
                  <option value="visita_tecnica">visita_tecnica</option>
                  <option value="levantamiento_cantidades">levantamiento_cantidades</option>
                  <option value="informe_tecnico">informe_tecnico</option>
                  <option value="revision_documental">revision_documental</option>
                  <option value="envio_cotizacion">envio_cotizacion</option>
                  <option value="seguimiento">seguimiento</option>
                  <option value="entrega_final">entrega_final</option>
                  <option value="otro">otro</option>
                </select>
                <select name="status" defaultValue={task.status}>
                  <option value="pendiente">pendiente</option>
                  <option value="en_progreso">en_progreso</option>
                  <option value="en_revision">en_revision</option>
                  <option value="completada">completada</option>
                  <option value="bloqueada">bloqueada</option>
                  <option value="cancelada">cancelada</option>
                </select>
                <select name="priority" defaultValue={task.priority}>
                  <option value="baja">baja</option>
                  <option value="media">media</option>
                  <option value="alta">alta</option>
                  <option value="critica">critica</option>
                </select>
                <input type="number" min="0" max="100" step="1" name="progress_percent" defaultValue={Number(task.progress_percent)} />
                <select name="responsible_user_id" defaultValue={task.responsible_user_id ?? ""}>
                  <option value="">Sin responsable</option>
                  {usersResp.data?.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name ?? user.id}
                    </option>
                  ))}
                </select>
                <input type="date" name="start_date" defaultValue={task.start_date ?? ""} />
                <input type="time" name="scheduled_time" defaultValue={task.scheduled_time ?? ""} />
                <input type="date" name="planned_end_date" defaultValue={task.planned_end_date ?? ""} />
                <input type="date" name="actual_end_date" defaultValue={task.actual_end_date ?? ""} />
                <label className="checkbox-row">
                  <input type="checkbox" name="alert_enabled" value="si" defaultChecked />
                  Alertas activas
                </label>
                <textarea className="span-2" name="notes" defaultValue={task.notes ?? ""} />
                <button type="submit">Actualizar tarea</button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
