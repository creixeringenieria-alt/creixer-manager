import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import { crearProyectoTecnicoAction, marcarAlertaLeidaAction } from "./actions";

interface ProyectosTecnicosPageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

export default async function ProyectosTecnicosPage({ searchParams }: ProyectosTecnicosPageProps) {
  await requirePageAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede acceder a proyectos técnicos."
  );

  const params = await searchParams;
  const supabase = createAdminClient();

  const [projectsResp, clientsResp, usersResp, tasksResp, deliverablesResp, followupsResp, alertsResp, requerimientosResp] =
    await Promise.all([
    supabase
      .from("technical_projects")
      .select("id, name, type, status, priority, start_date, planned_end_date, clients(name), director:profiles!technical_projects_director_responsible_id_fkey(full_name)")
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name, role").order("full_name"),
    supabase
      .from("technical_project_tasks")
      .select("id, project_id, status, planned_end_date")
      .neq("status", "completada"),
    supabase
      .from("technical_project_deliverables")
      .select("id, project_id, status")
      .not("status", "in", "(entregado,aprobado)"),
    supabase
      .from("technical_project_followups")
      .select("id, project_id, next_followup_date")
      .not("next_followup_date", "is", null),
      supabase
      .from("project_alerts")
      .select("id, project_id, alert_type, message, due_date, technical_projects(name)")
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(30),
      supabase.from("requerimientos").select("id, codigo_requerimiento").order("created_at", { ascending: false }).limit(100)
    ]);

  const today = new Date().toISOString().slice(0, 10);
  const overdueTasks = (tasksResp.data ?? []).filter((task) => task.planned_end_date && task.planned_end_date < today).length;
  const pendingDeliverables = deliverablesResp.data?.length ?? 0;
  const upcomingFollowups = (followupsResp.data ?? []).filter(
    (item) => item.next_followup_date && item.next_followup_date <= today
  ).length;
  const activeProjects = (projectsResp.data ?? []).filter((project) => ["planeado", "en_ejecucion", "en_pausa"].includes(project.status))
    .length;

  const projectsByType = (projectsResp.data ?? []).reduce<Record<string, number>>((acc, project) => {
    acc[project.type] = (acc[project.type] ?? 0) + 1;
    return acc;
  }, {});

  const projectsByResponsible = (projectsResp.data ?? []).reduce<Record<string, number>>((acc, project) => {
    const responsable = ((project.director as { full_name?: string } | null)?.full_name ?? "Sin director").trim();
    acc[responsable] = (acc[responsable] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Proyectos técnicos</h1>
          <p>Gestión operativa de mantenimiento, consultoría e interventoría.</p>
        </div>
        <Link href="/dashboard">Volver al dashboard</Link>
      </div>

      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}

      <section className="metrics-grid">
        <article className="card metric-card">
          <p className="metric-label">Proyectos activos</p>
          <p className="metric-value">{activeProjects}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Tareas vencidas</p>
          <p className="metric-value">{overdueTasks}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Entregables pendientes</p>
          <p className="metric-value">{pendingDeliverables}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Seguimientos próximos</p>
          <p className="metric-value">{upcomingFollowups}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Alertas activas</p>
          <p className="metric-value">{alertsResp.data?.length ?? 0}</p>
        </article>
      </section>

      <section className="card">
        <h2>Proyectos por tipo</h2>
        <div className="inline-form">
          <span className="status-pill">{`mantenimiento: ${projectsByType.mantenimiento ?? 0}`}</span>
          <span className="status-pill">{`consultoria: ${projectsByType.consultoria ?? 0}`}</span>
          <span className="status-pill">{`interventoria: ${projectsByType.interventoria ?? 0}`}</span>
        </div>
      </section>

      <section className="card">
        <h2>Proyectos por responsable</h2>
        <div className="inline-form">
          {Object.entries(projectsByResponsible).map(([name, count]) => (
            <span className="status-pill" key={name}>
              {name}: {count}
            </span>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Nuevo proyecto técnico</h2>
        <form action={crearProyectoTecnicoAction} className="form-grid">
          <input type="hidden" name="return_path" value="/dashboard/proyectos-tecnicos" />
          <select name="client_id" required>
            <option value="">Cliente</option>
            {clientsResp.data?.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <select name="type" required>
            <option value="mantenimiento">mantenimiento</option>
            <option value="consultoria">consultoria</option>
            <option value="interventoria">interventoria</option>
          </select>
          <input name="name" placeholder="Nombre del proyecto" required />
          <input name="location" placeholder="Ubicación" />
          <select name="linked_request_id">
            <option value="">Caso/requerimiento (opcional)</option>
            {requerimientosResp.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.codigo_requerimiento}
              </option>
            ))}
          </select>
          <select name="status" defaultValue="planeado">
            <option value="planeado">planeado</option>
            <option value="en_ejecucion">en_ejecucion</option>
            <option value="en_pausa">en_pausa</option>
          </select>
          <select name="priority" defaultValue="media">
            <option value="baja">baja</option>
            <option value="media">media</option>
            <option value="alta">alta</option>
            <option value="critica">critica</option>
          </select>
          <input type="date" name="start_date" required />
          <input type="date" name="planned_end_date" required />
          <select name="director_responsible_id">
            <option value="">Director responsable</option>
            {usersResp.data?.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name ?? user.id}
              </option>
            ))}
          </select>
          <select name="technical_lead_id">
            <option value="">Líder técnico</option>
            {usersResp.data?.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name ?? user.id}
              </option>
            ))}
          </select>
          <textarea className="span-2" name="description" placeholder="Descripción general del proyecto" />
          <div className="span-2 card" style={{ marginBottom: 0 }}>
            <h3>Documentos iniciales</h3>
            <div className="form-grid">
              <select name="project_document_type">
                <option value="convocatoria">convocatoria</option>
                <option value="terminos_referencia">terminos_referencia</option>
                <option value="anexos">anexos</option>
                <option value="planos">planos</option>
                <option value="documento_cliente">documento_cliente</option>
                <option value="archivo_tecnico">archivo_tecnico</option>
                <option value="otro">otro</option>
              </select>
              <input name="project_document_name" placeholder="Nombre para documentos (opcional)" />
              <label className="file-input-label span-2">
                Adjuntar archivos del proyecto
                <input type="file" name="project_files" multiple />
              </label>
            </div>
          </div>
          <label className="checkbox-row span-2">
            <input type="checkbox" name="generar_tareas_base" value="si" defaultChecked />
            Generar tareas base automáticamente (visita, cantidades, informe, revisión, cotización, seguimiento, entrega)
          </label>
          <button type="submit">Crear proyecto</button>
        </form>
      </section>

      <section className="card">
        <h2>Alertas</h2>
        {alertsResp.data?.length === 0 ? <p>No hay alertas pendientes.</p> : null}
        <div className="activities-list">
          {alertsResp.data?.map((alert) => (
            <article className="activity-item" key={alert.id}>
              <p>
                <strong>{alert.alert_type}</strong> | Proyecto:{" "}
                {(alert.technical_projects as { name?: string } | null)?.name ?? "-"}
              </p>
              <p>{alert.message}</p>
              <p>Vence: {alert.due_date ?? "-"}</p>
              <form action={marcarAlertaLeidaAction} className="inline-form">
                <input type="hidden" name="return_path" value="/dashboard/proyectos-tecnicos" />
                <input type="hidden" name="id" value={alert.id} />
                <button type="submit">Marcar leída</button>
                {alert.project_id ? <Link href={`/dashboard/proyectos-tecnicos/${alert.project_id}`}>Abrir proyecto</Link> : null}
              </form>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Listado de proyectos</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Prioridad</th>
                <th>Cliente</th>
                <th>Director</th>
                <th>Inicio</th>
                <th>Fin plan</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {projectsResp.data?.map((project) => (
                <tr key={project.id}>
                  <td>{project.name}</td>
                  <td>{project.type}</td>
                  <td>{project.status}</td>
                  <td>{project.priority}</td>
                  <td>{(project.clients as { name?: string } | null)?.name ?? "-"}</td>
                  <td>{(project.director as { full_name?: string } | null)?.full_name ?? "-"}</td>
                  <td>{project.start_date}</td>
                  <td>{project.planned_end_date}</td>
                  <td>
                    <Link href={`/dashboard/proyectos-tecnicos/${project.id}`}>Abrir</Link>
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
