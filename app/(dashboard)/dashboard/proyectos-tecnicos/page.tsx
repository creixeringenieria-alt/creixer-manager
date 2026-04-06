import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import { crearProyectoTecnicoAction, marcarAlertaLeidaAction } from "./actions";

interface ProyectosTecnicosPageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

interface ProjectRow {
  id: string;
  name: string;
  type: string;
  status: string;
  priority: string;
  start_date: string | null;
  planned_end_date: string | null;
  clients: { name?: string } | { name?: string }[] | null;
  director: { full_name?: string } | { full_name?: string }[] | null;
}

interface ClientRow {
  id: string;
  name: string;
}

interface UserRow {
  id: string;
  full_name: string | null;
  role: string | null;
}

interface TaskRow {
  id: string;
  project_id: string;
  status: string;
  planned_end_date: string | null;
}

interface DeliverableRow {
  id: string;
  project_id: string;
  status: string;
}

interface FollowupRow {
  id: string;
  project_id: string;
  next_followup_date: string | null;
}

interface AlertRow {
  id: string;
  project_id: string | null;
  alert_type: string;
  message: string;
  due_date: string | null;
  technical_projects: { name?: string } | { name?: string }[] | null;
}

interface RequerimientoRow {
  id: string;
  codigo_requerimiento: string | null;
}

export default async function ProyectosTecnicosPage({ searchParams }: ProyectosTecnicosPageProps) {
  await requirePagePermission(
    "ver_casos",
    "/dashboard",
    "Acceso denegado: tu rol no puede acceder a proyectos técnicos."
  );

  const route = "/dashboard/proyectos-tecnicos";
  const params = await searchParams;
  let hasQueryFailure = false;
  let supabase: ReturnType<typeof createAdminClient> | null = null;

  try {
    supabase = createAdminClient();
  } catch (error) {
    hasQueryFailure = true;
    console.error("[dashboard/proyectos-tecnicos] createAdminClient failed", {
      route,
      query: "createAdminClient",
      variable: "NEXT_PUBLIC_SUPABASE_URL | SUPABASE_SERVICE_ROLE_KEY",
      error: error instanceof Error ? error.message : String(error)
    });
  }

  async function runQuery<T>({
    queryName,
    variable,
    execute
  }: {
    queryName: string;
    variable: string;
    execute: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
  }): Promise<T[]> {
    if (!supabase) {
      return [];
    }

    try {
      const response = await execute();
      if (response.error) {
        hasQueryFailure = true;
        console.error("[dashboard/proyectos-tecnicos] query failed", {
          route,
          query: queryName,
          variable,
          error: response.error.message
        });
        return [];
      }
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      hasQueryFailure = true;
      console.error("[dashboard/proyectos-tecnicos] query threw exception", {
        route,
        query: queryName,
        variable,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  const [projects, clients, users, tasks, deliverables, followups, alerts, requerimientos] = await Promise.all([
    runQuery<ProjectRow>({
      queryName: "technical_projects.list",
      variable: "technical_projects",
      execute: () =>
        supabase!
          .from("technical_projects")
          .select(
            "id, name, type, status, priority, start_date, planned_end_date, clients(name), director:profiles!technical_projects_director_responsible_id_fkey(full_name)"
          )
          .order("created_at", { ascending: false })
    }),
    runQuery<ClientRow>({
      queryName: "clients.list",
      variable: "clients",
      execute: () => supabase!.from("clients").select("id, name").order("name")
    }),
    runQuery<UserRow>({
      queryName: "profiles.list",
      variable: "profiles",
      execute: () => supabase!.from("profiles").select("id, full_name, role").order("full_name")
    }),
    runQuery<TaskRow>({
      queryName: "technical_project_tasks.open",
      variable: "technical_project_tasks",
      execute: () =>
        supabase!.from("technical_project_tasks").select("id, project_id, status, planned_end_date").neq("status", "completada")
    }),
    runQuery<DeliverableRow>({
      queryName: "technical_project_deliverables.pending",
      variable: "technical_project_deliverables",
      execute: () =>
        supabase!.from("technical_project_deliverables").select("id, project_id, status").not("status", "in", "(entregado,aprobado)")
    }),
    runQuery<FollowupRow>({
      queryName: "technical_project_followups.next",
      variable: "technical_project_followups",
      execute: () =>
        supabase!.from("technical_project_followups").select("id, project_id, next_followup_date").not("next_followup_date", "is", null)
    }),
    runQuery<AlertRow>({
      queryName: "project_alerts.unread",
      variable: "project_alerts",
      execute: () =>
        supabase!
          .from("project_alerts")
          .select("id, project_id, alert_type, message, due_date, technical_projects(name)")
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(30)
    }),
    runQuery<RequerimientoRow>({
      queryName: "requerimientos.latest",
      variable: "requerimientos",
      execute: () =>
        supabase!.from("requerimientos").select("id, codigo_requerimiento").order("created_at", { ascending: false }).limit(100)
    })
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const overdueTasks = tasks.filter((task) => task.planned_end_date && task.planned_end_date < today).length;
  const pendingDeliverables = deliverables.length;
  const upcomingFollowups = followups.filter(
    (item) => item.next_followup_date && item.next_followup_date <= today
  ).length;
  const activeProjects = projects.filter((project) => ["planeado", "en_ejecucion", "en_pausa"].includes(project.status)).length;

  const projectsByType = projects.reduce<Record<string, number>>((acc, project) => {
    acc[project.type] = (acc[project.type] ?? 0) + 1;
    return acc;
  }, {});

  const projectsByResponsible = projects.reduce<Record<string, number>>((acc, project) => {
    const directorRow = Array.isArray(project.director) ? project.director[0] : project.director;
    const responsable = (directorRow?.full_name ?? "Sin director").trim();
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
      {hasQueryFailure ? <p className="feedback error">No fue posible cargar proyectos técnicos</p> : null}

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
          <p className="metric-value">{alerts.length}</p>
        </article>
      </section>

      <section className="card">
        <h2>Proyectos por tipo</h2>
        <div className="inline-form">
          <span className="status-pill">{`mantenimiento: ${projectsByType.mantenimiento ?? 0}`}</span>
          <span className="status-pill">{`consultoria: ${projectsByType.consultoria ?? 0}`}</span>
          <span className="status-pill">{`interventoria: ${projectsByType.interventoria ?? 0}`}</span>
          <span className="status-pill">{`obra_conjunto_residencial: ${projectsByType.obra_conjunto_residencial ?? 0}`}</span>
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
          <div className="form-field">
            <label className="form-field-label" htmlFor="project-client-id">
              Cliente
            </label>
            <select id="project-client-id" name="client_id" required>
              <option value="">Selecciona cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="project-type">
              Tipo de proyecto
            </label>
            <select id="project-type" name="type" required>
              <option value="mantenimiento">mantenimiento</option>
              <option value="consultoria">consultoria</option>
              <option value="interventoria">interventoria</option>
              <option value="obra_conjunto_residencial">obra_conjunto_residencial</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="project-name">
              Código interno de la inmobiliaria
            </label>
            <input id="project-name" name="name" required />
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="project-location">
              Ubicación
            </label>
            <input id="project-location" name="location" />
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="project-request-category">
              Caso/requerimiento
            </label>
            <select id="project-request-category" name="request_category" required defaultValue="mantenimiento_general">
              <option value="hidraulico">hidraulico</option>
              <option value="electrico">electrico</option>
              <option value="gasodomestico">gasodomestico</option>
              <option value="albanileria">albanileria</option>
              <option value="acabados">acabados</option>
              <option value="mantenimiento_general">mantenimiento_general</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="project-linked-request-id">
              Vincular requerimiento existente (opcional)
            </label>
            <select id="project-linked-request-id" name="linked_request_id">
              <option value="">Sin requerimiento relacionado</option>
              {requerimientos.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.codigo_requerimiento}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="project-status">
              Estado
            </label>
            <select id="project-status" name="status" defaultValue="en_visita">
              <option value="en_visita">en_visita</option>
              <option value="planeado">planeado</option>
              <option value="en_ejecucion">en_ejecucion</option>
              <option value="en_pausa">en_pausa</option>
              <option value="completado">completado</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="project-priority">
              Prioridad
            </label>
            <select id="project-priority" name="priority" defaultValue="media">
              <option value="baja">baja</option>
              <option value="media">media</option>
              <option value="alta">alta</option>
              <option value="critica">critica</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="project-start-date">
              Fecha de inicio del proyecto
            </label>
            <input id="project-start-date" type="date" name="start_date" required />
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="project-estimated-end-date">
              Fecha estimada de entrega
            </label>
            <input id="project-estimated-end-date" type="date" name="estimated_end_date" />
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="project-technical-lead-id">
              Líder técnico
            </label>
            <select id="project-technical-lead-id" name="technical_lead_id">
              <option value="">Sin líder técnico</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name ?? user.id}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="project-director-responsible-id">
              Director responsable
            </label>
            <select id="project-director-responsible-id" name="director_responsible_id">
              <option value="">Sin director responsable</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name ?? user.id}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field span-2">
            <label className="form-field-label" htmlFor="project-description">
              Descripción general del proyecto
            </label>
            <textarea id="project-description" name="description" />
          </div>
          <div className="span-2 card" style={{ marginBottom: 0 }}>
            <h3>Documentos iniciales</h3>
            <div className="form-grid">
              <div className="form-field">
                <label className="form-field-label" htmlFor="project-document-type">
                  Tipo de documento inicial
                </label>
                <select id="project-document-type" name="project_document_type">
                  <option value="convocatoria">convocatoria</option>
                  <option value="terminos_referencia">terminos_referencia</option>
                  <option value="anexos">anexos</option>
                  <option value="planos">planos</option>
                  <option value="documento_cliente">documento_cliente</option>
                  <option value="archivo_tecnico">archivo_tecnico</option>
                  <option value="otro">otro</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-field-label" htmlFor="project-document-name">
                  Nombre para documentos (opcional)
                </label>
                <input id="project-document-name" name="project_document_name" />
              </div>
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
        {alerts.length === 0 ? <p>No hay alertas pendientes.</p> : null}
        <div className="activities-list">
          {alerts.map((alert) => (
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
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>{project.name}</td>
                  <td>{project.type}</td>
                  <td>{project.status}</td>
                  <td>{project.priority}</td>
                  <td>{(Array.isArray(project.clients) ? project.clients[0] : project.clients)?.name ?? "-"}</td>
                  <td>{(Array.isArray(project.director) ? project.director[0] : project.director)?.full_name ?? "-"}</td>
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
