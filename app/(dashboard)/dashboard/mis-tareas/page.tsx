import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

import { marcarEstadoTareaAction, subirFotoTareaAction } from "./actions";

interface MisTareasPageProps {
  searchParams: Promise<{ ok?: string; error?: string; responsable?: string; estado?: string; periodo?: string }>;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function MisTareasPage({ searchParams }: MisTareasPageProps) {
  const role = await requirePageAccess(
    ["tecnico", "administrador"],
    "/dashboard",
    "Acceso denegado: este módulo es para técnico y administrador."
  );

  const params = await searchParams;
  const supabase = (await createClient()) as any;

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main>
        <p className="feedback error">Debes iniciar sesión para ver tus tareas.</p>
      </main>
    );
  }

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const weekEnd = new Date();
  weekEnd.setDate(today.getDate() + 7);

  const todayStr = dateOnly(today);
  const tomorrowStr = dateOnly(tomorrow);
  const weekEndStr = dateOnly(weekEnd);

  let agendaQuery = supabase
    .from("agenda_operativa")
    .select(
      "id, tecnico_id, fecha_programada, franja_horaria, tipo_visita, direccion, contacto, observaciones_logisticas, estado_agenda, requerimientos(codigo_requerimiento, descripcion, clients(name)), profiles(full_name)"
    )
    .order("fecha_programada", { ascending: true })
    .order("franja_horaria", { ascending: true });

  if (role === "tecnico") {
    agendaQuery = agendaQuery.eq("tecnico_id", user.id).in("fecha_programada", [todayStr, tomorrowStr]);
  } else {
    const periodo = params.periodo ?? "semana";
    if (periodo === "hoy") {
      agendaQuery = agendaQuery.eq("fecha_programada", todayStr);
    } else {
      agendaQuery = agendaQuery.gte("fecha_programada", todayStr).lte("fecha_programada", weekEndStr);
    }
    if (params.responsable) {
      agendaQuery = agendaQuery.eq("tecnico_id", params.responsable);
    }
    if (params.estado) {
      agendaQuery = agendaQuery.eq("estado_agenda", params.estado);
    }
  }

  const [agendaResp, usersResp, projectTasksResp] = await Promise.all([
    agendaQuery,
    supabase.from("profiles").select("id, full_name, role").eq("role", "tecnico").order("full_name"),
    role === "administrador"
      ? supabase
          .from("technical_project_tasks")
          .select(
            "id, name, status, priority, progress_percent, planned_end_date, scheduled_time, technical_projects(name), profiles(full_name)"
          )
          .order("planned_end_date", { ascending: true })
          .limit(200)
      : Promise.resolve({ data: [], error: null })
  ]);

  const rows = (agendaResp.data ?? []) as any[];
  const tasksToday = rows.filter((item) => item.fecha_programada === todayStr);
  const tasksTomorrow = rows.filter((item) => item.fecha_programada === tomorrowStr);

  if (role === "tecnico") {
    return (
      <main className="mobile-main">
        <div className="page-header">
          <div>
            <h1>Mis tareas</h1>
            <p>Vista operativa móvil.</p>
          </div>
          <Link href="/dashboard">Volver</Link>
        </div>

        {params.error ? <p className="feedback error">{params.error}</p> : null}
        {params.ok ? <p className="feedback success">{params.ok}</p> : null}
        {agendaResp.error ? <p className="feedback error">{agendaResp.error.message}</p> : null}

        <section className="card">
          <h2>Hoy ({todayStr})</h2>
          <div className="tasks-mobile-grid">
            {tasksToday.length === 0 ? <p>No tienes tareas para hoy.</p> : null}
            {tasksToday.map((task) => (
              <article className="task-mobile-card" key={task.id}>
                <p>
                  <strong>{task.tipo_visita}</strong> - {task.franja_horaria}
                </p>
                <p>{task.direccion}</p>
                <p>
                  Cliente:{" "}
                  {((task.requerimientos as { clients?: { name?: string } } | null)?.clients as { name?: string } | undefined)?.name ??
                    "-"}
                </p>
                <p>Contacto: {task.contacto ?? "-"}</p>
                <p>Obs: {task.observaciones_logisticas ?? "-"}</p>
                <p>Estado: {task.estado_agenda}</p>

                <div className="task-actions-mobile">
                  <form action={marcarEstadoTareaAction}>
                    <input type="hidden" name="agenda_id" value={task.id} />
                    <input type="hidden" name="estado_agenda" value="en_camino" />
                    <button type="submit">En camino</button>
                  </form>
                  <form action={marcarEstadoTareaAction}>
                    <input type="hidden" name="agenda_id" value={task.id} />
                    <input type="hidden" name="estado_agenda" value="en_sitio" />
                    <button type="submit">En sitio</button>
                  </form>
                  <Link href={`/dashboard/reporte-visita?agenda_id=${task.id}`} className="mobile-link-btn">
                    Abrir reporte
                  </Link>
                  <form action={marcarEstadoTareaAction}>
                    <input type="hidden" name="agenda_id" value={task.id} />
                    <input type="hidden" name="estado_agenda" value="cerrada" />
                    <button type="submit">Cerrar visita</button>
                  </form>
                </div>

                <form action={subirFotoTareaAction} className="mobile-upload-form">
                  <input type="hidden" name="agenda_id" value={task.id} />
                  <input type="file" name="fotos" multiple accept="image/*" />
                  <input name="descripcion" placeholder="Descripción opcional" />
                  <button type="submit">Subir fotos</button>
                </form>
              </article>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Mañana ({tomorrowStr})</h2>
          <div className="tasks-mobile-grid">
            {tasksTomorrow.length === 0 ? <p>No tienes tareas para mañana.</p> : null}
            {tasksTomorrow.map((task) => (
              <article className="task-mobile-card" key={task.id}>
                <p>
                  <strong>{task.tipo_visita}</strong> - {task.franja_horaria}
                </p>
                <p>{task.direccion}</p>
                <p>
                  Cliente:{" "}
                  {((task.requerimientos as { clients?: { name?: string } } | null)?.clients as { name?: string } | undefined)?.name ??
                    "-"}
                </p>
                <p>Contacto: {task.contacto ?? "-"}</p>
                <p>Obs: {task.observaciones_logisticas ?? "-"}</p>
                <p>Estado: {task.estado_agenda}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    );
  }

  const projectTasks = (projectTasksResp.data ?? []) as any[];
  const vencidasProyecto = projectTasks.filter((t) => t.status !== "completada" && t.planned_end_date && t.planned_end_date < todayStr);
  const proximasProyecto = projectTasks.filter(
    (t) => t.status !== "completada" && t.planned_end_date && t.planned_end_date >= todayStr && t.planned_end_date <= weekEndStr
  );

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Mis tareas / Vista administrador</h1>
          <p>Seguimiento general de tareas del equipo, vencidas y próximas.</p>
        </div>
        <Link href="/dashboard">Volver</Link>
      </div>

      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}

      <section className="metrics-grid">
        <article className="card metric-card">
          <p className="metric-label">Visitas hoy</p>
          <p className="metric-value">{rows.filter((row) => row.fecha_programada === todayStr).length}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Visitas semana</p>
          <p className="metric-value">{rows.length}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Tareas proyecto vencidas</p>
          <p className="metric-value">{vencidasProyecto.length}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Tareas proyecto próximas</p>
          <p className="metric-value">{proximasProyecto.length}</p>
        </article>
      </section>

      <section className="card">
        <h2>Filtros</h2>
        <form method="GET" className="inline-form">
          <select name="periodo" defaultValue={params.periodo ?? "semana"}>
            <option value="hoy">hoy</option>
            <option value="semana">semana</option>
          </select>
          <select name="responsable" defaultValue={params.responsable ?? ""}>
            <option value="">Todos los responsables</option>
            {usersResp.data?.map((user: { id: string; full_name?: string | null }) => (
              <option key={user.id} value={user.id}>
                {user.full_name ?? user.id}
              </option>
            ))}
          </select>
          <select name="estado" defaultValue={params.estado ?? ""}>
            <option value="">Todos los estados</option>
            <option value="programada">programada</option>
            <option value="confirmada">confirmada</option>
            <option value="en_camino">en_camino</option>
            <option value="en_sitio">en_sitio</option>
            <option value="cerrada">cerrada</option>
            <option value="no_efectiva">no_efectiva</option>
          </select>
          <button type="submit">Aplicar</button>
        </form>
      </section>

      <section className="card">
        <h2>Tareas del equipo (agenda operativa)</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Cliente</th>
                <th>Caso</th>
                <th>Actividad</th>
                <th>Responsable</th>
                <th>Estado</th>
                <th>Ubicación</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((task) => (
                <tr key={task.id}>
                  <td>{task.fecha_programada}</td>
                  <td>{task.franja_horaria}</td>
                  <td>
                    {((task.requerimientos as { clients?: { name?: string } } | null)?.clients as { name?: string } | undefined)?.name ??
                      "-"}
                  </td>
                  <td>{(task.requerimientos as { codigo_requerimiento?: string } | null)?.codigo_requerimiento ?? "-"}</td>
                  <td>{task.tipo_visita}</td>
                  <td>{(task.profiles as { full_name?: string } | null)?.full_name ?? "-"}</td>
                  <td>{task.estado_agenda}</td>
                  <td>{task.direccion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Tareas de proyectos vencidas</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Tarea</th>
                <th>Responsable</th>
                <th>Vence</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {vencidasProyecto.map((task) => (
                <tr key={task.id}>
                  <td>{(task.technical_projects as { name?: string } | null)?.name ?? "-"}</td>
                  <td>{task.name}</td>
                  <td>{(task.profiles as { full_name?: string } | null)?.full_name ?? "-"}</td>
                  <td>{task.planned_end_date}</td>
                  <td>{task.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
