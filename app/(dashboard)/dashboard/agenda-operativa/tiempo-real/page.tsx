import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

interface AgendaTiempoRealPageProps {
  searchParams: Promise<{ periodo?: string; responsable?: string; tipo_proyecto?: string; estado?: string }>;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function AgendaTiempoRealPage({ searchParams }: AgendaTiempoRealPageProps) {
  await requirePageAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede acceder a la agenda en tiempo real."
  );

  const params = await searchParams;
  const periodo = params.periodo ?? "hoy";
  const responsable = params.responsable ?? "";
  const tipoProyecto = params.tipo_proyecto ?? "";
  const estado = params.estado ?? "";

  const supabase = createAdminClient();
  const today = new Date();
  const todayStr = dateOnly(today);
  const weekEnd = new Date();
  weekEnd.setDate(today.getDate() + 7);
  const weekEndStr = dateOnly(weekEnd);

  let agendaQuery = supabase
    .from("agenda_operativa")
    .select(
      "id, fecha_programada, franja_horaria, tipo_visita, direccion, observaciones_logisticas, estado_agenda, tecnico_id, requerimientos(codigo_requerimiento, clients(name)), profiles(full_name)"
    )
    .order("fecha_programada", { ascending: true })
    .order("franja_horaria", { ascending: true });

  if (periodo === "hoy") {
    agendaQuery = agendaQuery.eq("fecha_programada", todayStr);
  } else {
    agendaQuery = agendaQuery.gte("fecha_programada", todayStr).lte("fecha_programada", weekEndStr);
  }
  if (responsable) {
    agendaQuery = agendaQuery.eq("tecnico_id", responsable);
  }
  if (estado) {
    agendaQuery = agendaQuery.eq("estado_agenda", estado);
  }

  let projectTasksQuery = supabase
    .from("technical_project_tasks")
    .select(
      "id, name, task_type, status, start_date, scheduled_time, planned_end_date, notes, responsible_user_id, technical_projects(name, type, location, clients(name)), profiles(full_name)"
    )
    .order("start_date", { ascending: true });

  if (periodo === "hoy") {
    projectTasksQuery = projectTasksQuery.eq("start_date", todayStr);
  } else {
    projectTasksQuery = projectTasksQuery.gte("start_date", todayStr).lte("start_date", weekEndStr);
  }
  if (responsable) {
    projectTasksQuery = projectTasksQuery.eq("responsible_user_id", responsable);
  }
  if (estado) {
    projectTasksQuery = projectTasksQuery.eq("status", estado);
  }
  if (tipoProyecto) {
    projectTasksQuery = projectTasksQuery.eq("technical_projects.type", tipoProyecto);
  }

  const [agendaResp, projectTasksResp, usersResp] = await Promise.all([
    agendaQuery,
    projectTasksQuery,
    supabase.from("profiles").select("id, full_name, role").order("full_name")
  ]);

  const rowsAgenda = (agendaResp.data ?? []).map((item) => ({
    id: `agenda-${item.id}`,
    fecha: item.fecha_programada,
    hora: item.franja_horaria,
    cliente: ((item.requerimientos as { clients?: { name?: string } } | null)?.clients as { name?: string } | undefined)?.name ?? "-",
    casoProyecto: (item.requerimientos as { codigo_requerimiento?: string } | null)?.codigo_requerimiento ?? "-",
    tipoActividad: item.tipo_visita,
    responsable: (item.profiles as { full_name?: string } | null)?.full_name ?? "-",
    estado: item.estado_agenda,
    ubicacion: item.direccion ?? "-",
    observaciones: item.observaciones_logisticas ?? "-",
    tipoProyecto: "mantenimiento"
  }));

  const rowsProyecto = (projectTasksResp.data ?? []).map((task) => ({
    id: `proyecto-${task.id}`,
    fecha: task.start_date ?? "-",
    hora: task.scheduled_time ?? "-",
    cliente:
      ((task.technical_projects as { clients?: { name?: string } } | null)?.clients as { name?: string } | undefined)?.name ?? "-",
    casoProyecto: (task.technical_projects as { name?: string } | null)?.name ?? "-",
    tipoActividad: task.task_type ?? task.name,
    responsable: (task.profiles as { full_name?: string } | null)?.full_name ?? "-",
    estado: task.status,
    ubicacion: (task.technical_projects as { location?: string } | null)?.location ?? "-",
    observaciones: task.notes ?? "-",
    tipoProyecto: (task.technical_projects as { type?: string } | null)?.type ?? "-"
  }));

  const rows = [...rowsAgenda, ...rowsProyecto].sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Agenda / visitas en tiempo real</h1>
          <p>Visitas y actividades programadas de operación + consultoría/interventoría.</p>
        </div>
        <div className="inline-form">
          <Link href="/dashboard/agenda-operativa">Agenda operativa</Link>
          <Link href="/dashboard/proyectos-tecnicos">Proyectos técnicos</Link>
        </div>
      </div>

      <section className="card">
        <h2>Filtros</h2>
        <form method="GET" className="inline-form">
          <select name="periodo" defaultValue={periodo}>
            <option value="hoy">hoy</option>
            <option value="semana">semana</option>
          </select>
          <select name="responsable" defaultValue={responsable}>
            <option value="">Todos los responsables</option>
            {usersResp.data?.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name ?? user.id}
              </option>
            ))}
          </select>
          <select name="tipo_proyecto" defaultValue={tipoProyecto}>
            <option value="">Todos los tipos</option>
            <option value="mantenimiento">mantenimiento</option>
            <option value="consultoria">consultoria</option>
            <option value="interventoria">interventoria</option>
          </select>
          <select name="estado" defaultValue={estado}>
            <option value="">Todos los estados</option>
            <option value="programada">programada</option>
            <option value="confirmada">confirmada</option>
            <option value="en_camino">en_camino</option>
            <option value="en_sitio">en_sitio</option>
            <option value="cerrada">cerrada</option>
            <option value="no_efectiva">no_efectiva</option>
            <option value="pendiente">pendiente</option>
            <option value="en_progreso">en_progreso</option>
            <option value="en_revision">en_revision</option>
            <option value="completada">completada</option>
            <option value="bloqueada">bloqueada</option>
          </select>
          <button type="submit">Aplicar</button>
        </form>
      </section>

      <section className="card">
        <h2>Programación en tiempo real</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Cliente</th>
                <th>Caso/Proyecto</th>
                <th>Tipo actividad</th>
                <th>Tipo proyecto</th>
                <th>Responsable</th>
                <th>Estado</th>
                <th>Ubicación</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.fecha}</td>
                  <td>{row.hora}</td>
                  <td>{row.cliente}</td>
                  <td>{row.casoProyecto}</td>
                  <td>{row.tipoActividad}</td>
                  <td>{row.tipoProyecto}</td>
                  <td>{row.responsable}</td>
                  <td>{row.estado}</td>
                  <td>{row.ubicacion}</td>
                  <td>{row.observaciones}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
