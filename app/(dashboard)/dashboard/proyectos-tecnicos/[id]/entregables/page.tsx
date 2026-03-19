import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import { crearEntregableProyectoAction } from "../../actions";

interface EntregablesPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}

export default async function EntregablesPage({ params, searchParams }: EntregablesPageProps) {
  await requirePageAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede acceder a entregables."
  );

  const { id } = await params;
  const query = await searchParams;
  const supabase = createAdminClient();

  const [projectResp, tasksResp, usersResp, deliverablesResp] = await Promise.all([
    supabase.from("technical_projects").select("id, name").eq("id", id).maybeSingle(),
    supabase.from("technical_project_tasks").select("id, name").eq("project_id", id).order("name"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase
      .from("technical_project_deliverables")
      .select("id, deliverable_type, name, version, status, planned_delivery_date, actual_delivery_date, file_url, notes, profiles(full_name), technical_project_tasks(name)")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
  ]);

  if (!projectResp.data) {
    return (
      <main>
        <p className="feedback error">Proyecto no encontrado.</p>
        <Link href="/dashboard/proyectos-tecnicos">Volver</Link>
      </main>
    );
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Entregables</h1>
          <p>
            Proyecto: <strong>{projectResp.data.name}</strong>
          </p>
        </div>
        <Link href={`/dashboard/proyectos-tecnicos/${id}`}>Volver al proyecto</Link>
      </div>

      {query.error ? <p className="feedback error">{query.error}</p> : null}
      {query.ok ? <p className="feedback success">{query.ok}</p> : null}

      <section className="card">
        <h2>Nuevo entregable</h2>
        <form action={crearEntregableProyectoAction} className="form-grid">
          <input type="hidden" name="return_path" value={`/dashboard/proyectos-tecnicos/${id}/entregables`} />
          <input type="hidden" name="project_id" value={id} />
          <input name="deliverable_type" placeholder="Tipo entregable" required />
          <input name="name" placeholder="Nombre entregable" required />
          <input name="version" defaultValue="1.0" />
          <select name="status" defaultValue="pendiente">
            <option value="pendiente">pendiente</option>
            <option value="en_preparacion">en_preparacion</option>
            <option value="entregado">entregado</option>
            <option value="aprobado">aprobado</option>
            <option value="rechazado">rechazado</option>
          </select>
          <select name="task_id">
            <option value="">Sin tarea</option>
            {tasksResp.data?.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name}
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
          <input type="date" name="planned_delivery_date" />
          <input type="date" name="actual_delivery_date" />
          <input name="file_url" placeholder="URL archivo (opcional)" />
          <textarea className="span-2" name="notes" placeholder="Notas" />
          <button type="submit">Registrar entregable</button>
        </form>
      </section>

      <section className="card">
        <h2>Listado de entregables</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Versión</th>
                <th>Estado</th>
                <th>Tarea</th>
                <th>Responsable</th>
                <th>Entrega plan</th>
                <th>Entrega real</th>
                <th>Archivo</th>
              </tr>
            </thead>
            <tbody>
              {deliverablesResp.data?.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.deliverable_type}</td>
                  <td>{row.version}</td>
                  <td>{row.status}</td>
                  <td>{(row.technical_project_tasks as { name?: string } | null)?.name ?? "-"}</td>
                  <td>{(row.profiles as { full_name?: string } | null)?.full_name ?? "-"}</td>
                  <td>{row.planned_delivery_date ?? "-"}</td>
                  <td>{row.actual_delivery_date ?? "-"}</td>
                  <td>{row.file_url ? <a href={row.file_url}>Abrir</a> : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
