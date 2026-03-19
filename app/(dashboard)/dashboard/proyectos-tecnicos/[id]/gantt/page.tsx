import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

interface GanttPageProps {
  params: Promise<{ id: string }>;
}

function dayMs() {
  return 1000 * 60 * 60 * 24;
}

function toDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00`) : null;
}

function maxDate(values: Date[]) {
  return values.reduce((max, current) => (current > max ? current : max), values[0]);
}

function minDate(values: Date[]) {
  return values.reduce((min, current) => (current < min ? current : min), values[0]);
}

function statusColor(status: string) {
  if (status === "completada") return "#16a34a";
  if (status === "en_progreso") return "#2563eb";
  if (status === "bloqueada" || status === "cancelada") return "#b91c1c";
  if (status === "en_revision") return "#ca8a04";
  return "#64748b";
}

export default async function GanttPage({ params }: GanttPageProps) {
  await requirePageAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede acceder al cronograma."
  );

  const { id } = await params;
  const supabase = createAdminClient();

  const [projectResp, phasesResp, tasksResp] = await Promise.all([
    supabase.from("technical_projects").select("id, name").eq("id", id).maybeSingle(),
    supabase
      .from("technical_project_phases")
      .select("id, name, phase_order, status, start_date, planned_end_date")
      .eq("project_id", id)
      .order("phase_order"),
    supabase
      .from("technical_project_tasks")
      .select("id, name, status, start_date, planned_end_date, depends_on_task_id, phase_id, progress_percent")
      .eq("project_id", id)
      .order("created_at", { ascending: true })
  ]);

  if (!projectResp.data) {
    return (
      <main>
        <p className="feedback error">Proyecto no encontrado.</p>
        <Link href="/dashboard/proyectos-tecnicos">Volver</Link>
      </main>
    );
  }

  const dateCandidates = [
    ...(phasesResp.data ?? [])
      .flatMap((row) => [toDate(row.start_date), toDate(row.planned_end_date)])
      .filter((value): value is Date => Boolean(value)),
    ...(tasksResp.data ?? [])
      .flatMap((row) => [toDate(row.start_date), toDate(row.planned_end_date)])
      .filter((value): value is Date => Boolean(value))
  ];

  const fallbackStart = new Date();
  const timelineStart = dateCandidates.length > 0 ? minDate(dateCandidates) : fallbackStart;
  const timelineEnd = dateCandidates.length > 0 ? maxDate(dateCandidates) : new Date(fallbackStart.getTime() + dayMs() * 30);
  const totalDays = Math.max(1, Math.ceil((timelineEnd.getTime() - timelineStart.getTime()) / dayMs()));

  const tasksByPhase = new Map<string, any[]>();

  for (const task of tasksResp.data ?? []) {
    const key = task.phase_id ?? "sin-fase";
    const list = tasksByPhase.get(key) ?? [];
    list.push(task);
    tasksByPhase.set(key, list);
  }

  const overdueToday = new Date().toISOString().slice(0, 10);

  function ganttBlock(startDate: string | null, endDate: string | null, color: string) {
    const start = toDate(startDate) ?? timelineStart;
    const end = toDate(endDate) ?? start;
    const offsetDays = Math.max(0, Math.floor((start.getTime() - timelineStart.getTime()) / dayMs()));
    const durationDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / dayMs()) + 1);
    const left = (offsetDays / totalDays) * 100;
    const width = (durationDays / totalDays) * 100;

    return <div className="gantt-block" style={{ left: `${left}%`, width: `${width}%`, background: color }} />;
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Cronograma / Gantt</h1>
          <p>
            Proyecto: <strong>{projectResp.data.name}</strong>
          </p>
        </div>
        <div className="inline-form">
          <Link href={`/dashboard/proyectos-tecnicos/${id}`}>Volver al proyecto</Link>
          <Link href="/dashboard/proyectos-tecnicos">Listado</Link>
        </div>
      </div>

      <section className="card">
        <p>
          Ventana del cronograma: {timelineStart.toISOString().slice(0, 10)} a {timelineEnd.toISOString().slice(0, 10)}
        </p>
      </section>

      <section className="card">
        <h2>Fases y tareas</h2>
        <div className="gantt-grid">
          {(phasesResp.data ?? []).map((phase) => (
            <div key={phase.id} className="gantt-row-group">
              <div className="gantt-row-meta">
                <strong>
                  Fase {phase.phase_order}: {phase.name}
                </strong>
                <p>{phase.status}</p>
              </div>
              <div className="gantt-row-track">{ganttBlock(phase.start_date, phase.planned_end_date, "#0f766e")}</div>

              {(tasksByPhase.get(phase.id) ?? []).map((task) => {
                const isOverdue =
                  task.status !== "completada" && task.planned_end_date !== null && task.planned_end_date < overdueToday;
                return (
                  <div key={task.id} className="gantt-row-task">
                    <div className="gantt-row-meta">
                      <span>
                        {task.name} ({task.progress_percent}%)
                      </span>
                      <small>
                        {task.status}
                        {task.depends_on_task_id ? " | con dependencia" : ""}
                        {isOverdue ? " | vencida" : ""}
                      </small>
                    </div>
                    <div className="gantt-row-track">{ganttBlock(task.start_date, task.planned_end_date, statusColor(task.status))}</div>
                  </div>
                );
              })}
            </div>
          ))}

          {(tasksByPhase.get("sin-fase") ?? []).length > 0 ? (
            <div className="gantt-row-group">
              <div className="gantt-row-meta">
                <strong>Tareas sin fase</strong>
              </div>
              {(tasksByPhase.get("sin-fase") ?? []).map((task) => (
                <div key={task.id} className="gantt-row-task">
                  <div className="gantt-row-meta">
                    <span>
                      {task.name} ({task.progress_percent}%)
                    </span>
                    <small>{task.status}</small>
                  </div>
                  <div className="gantt-row-track">{ganttBlock(task.start_date, task.planned_end_date, statusColor(task.status))}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
