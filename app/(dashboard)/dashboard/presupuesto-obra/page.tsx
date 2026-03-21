import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function PresupuestoObraPage() {
  await requirePageAccess(
    ["administrador", "asistente", "contabilidad"],
    "/dashboard",
    "No tienes permiso para acceder a presupuesto de obra."
  );

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("technical_projects")
    .select("id,name,type,status,planned_end_date,clients(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main>
      <h1>Presupuesto obra</h1>
      <p>Selecciona un proyecto para abrir su presupuesto por capítulos y documento final.</p>
      {error ? <p className="feedback error">{error.message}</p> : null}

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Proyectos técnicos</h2>
        <table className="table-responsive">
          <thead>
            <tr>
              <th>Proyecto</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Fecha fin plan</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((project: any) => (
              <tr key={project.id}>
                <td>{project.name}</td>
                <td>{project.clients?.name ?? "Sin cliente"}</td>
                <td>{project.type}</td>
                <td>{project.status}</td>
                <td>{project.planned_end_date ?? "-"}</td>
                <td>
                  <Link href={`/dashboard/proyectos-tecnicos/${project.id}/presupuesto`}>Abrir presupuesto</Link>
                </td>
              </tr>
            ))}
            {(data ?? []).length === 0 ? (
              <tr>
                <td colSpan={6}>No hay proyectos disponibles.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
