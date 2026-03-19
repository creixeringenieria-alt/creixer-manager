import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import { crearCantidadProyectoAction } from "../../actions";

interface CantidadesPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}

export default async function CantidadesPage({ params, searchParams }: CantidadesPageProps) {
  await requirePageAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede acceder a cantidades."
  );

  const { id } = await params;
  const query = await searchParams;
  const supabase = createAdminClient();

  const [projectResp, tasksResp, quantitiesResp] = await Promise.all([
    supabase.from("technical_projects").select("id, name").eq("id", id).maybeSingle(),
    supabase.from("technical_project_tasks").select("id, name").eq("project_id", id).order("name"),
    supabase
      .from("technical_project_quantities")
      .select("id, quantity_type, item_name, value, unit, notes, technical_project_tasks(name)")
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

  const byItem = new Map<string, Record<string, number>>();
  for (const row of quantitiesResp.data ?? []) {
    const current = byItem.get(row.item_name) ?? { sitio: 0, modelo: 0, calculada: 0, diferencia: 0 };
    current[row.quantity_type] = (current[row.quantity_type] ?? 0) + Number(row.value);
    byItem.set(row.item_name, current);
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Cantidades</h1>
          <p>
            Proyecto: <strong>{projectResp.data.name}</strong>
          </p>
        </div>
        <Link href={`/dashboard/proyectos-tecnicos/${id}`}>Volver al proyecto</Link>
      </div>

      {query.error ? <p className="feedback error">{query.error}</p> : null}
      {query.ok ? <p className="feedback success">{query.ok}</p> : null}

      <section className="card">
        <h2>Registrar cantidad</h2>
        <form action={crearCantidadProyectoAction} className="form-grid">
          <input type="hidden" name="return_path" value={`/dashboard/proyectos-tecnicos/${id}/cantidades`} />
          <input type="hidden" name="project_id" value={id} />
          <input name="item_name" placeholder="Ítem" required />
          <select name="quantity_type" defaultValue="sitio">
            <option value="sitio">sitio</option>
            <option value="modelo">modelo</option>
            <option value="calculada">calculada</option>
            <option value="diferencia">diferencia</option>
          </select>
          <input type="number" step="0.0001" name="value" placeholder="Valor" required />
          <input name="unit" placeholder="Unidad" required />
          <select name="task_id">
            <option value="">Sin tarea</option>
            {tasksResp.data?.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name}
              </option>
            ))}
          </select>
          <textarea className="span-2" name="notes" placeholder="Notas" />
          <button type="submit">Registrar cantidad</button>
        </form>
      </section>

      <section className="card">
        <h2>Comparativo por ítem</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ítem</th>
                <th>Sitio</th>
                <th>Modelo</th>
                <th>Calculada</th>
                <th>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(byItem.entries()).map(([item, values]) => (
                <tr key={item}>
                  <td>{item}</td>
                  <td>{values.sitio ?? 0}</td>
                  <td>{values.modelo ?? 0}</td>
                  <td>{values.calculada ?? 0}</td>
                  <td>{values.diferencia ?? (values.sitio ?? 0) - (values.modelo ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Registros de cantidades</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ítem</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Unidad</th>
                <th>Tarea</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {quantitiesResp.data?.map((row) => (
                <tr key={row.id}>
                  <td>{row.item_name}</td>
                  <td>{row.quantity_type}</td>
                  <td>{Number(row.value)}</td>
                  <td>{row.unit}</td>
                  <td>{(row.technical_project_tasks as { name?: string } | null)?.name ?? "-"}</td>
                  <td>{row.notes ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
