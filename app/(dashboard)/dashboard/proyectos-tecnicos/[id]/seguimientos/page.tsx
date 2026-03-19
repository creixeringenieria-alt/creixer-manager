import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import { crearSeguimientoProyectoAction } from "../../actions";

interface SeguimientosPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}

export default async function SeguimientosPage({ params, searchParams }: SeguimientosPageProps) {
  await requirePageAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede acceder a seguimientos."
  );

  const { id } = await params;
  const query = await searchParams;
  const supabase = createAdminClient();

  const [projectResp, usersResp, followupsResp] = await Promise.all([
    supabase.from("technical_projects").select("id, name").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase
      .from("technical_project_followups")
      .select("id, followup_type, date, summary, commitments, next_followup_date, alert_enabled, profiles(full_name)")
      .eq("project_id", id)
      .order("date", { ascending: false })
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
          <h1>Seguimientos</h1>
          <p>
            Proyecto: <strong>{projectResp.data.name}</strong>
          </p>
        </div>
        <Link href={`/dashboard/proyectos-tecnicos/${id}`}>Volver al proyecto</Link>
      </div>

      {query.error ? <p className="feedback error">{query.error}</p> : null}
      {query.ok ? <p className="feedback success">{query.ok}</p> : null}

      <section className="card">
        <h2>Nuevo seguimiento</h2>
        <form action={crearSeguimientoProyectoAction} className="form-grid">
          <input type="hidden" name="return_path" value={`/dashboard/proyectos-tecnicos/${id}/seguimientos`} />
          <input type="hidden" name="project_id" value={id} />
          <input name="followup_type" placeholder="Tipo seguimiento" required />
          <input type="date" name="date" />
          <select name="responsible_user_id">
            <option value="">Responsable</option>
            {usersResp.data?.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name ?? user.id}
              </option>
            ))}
          </select>
          <input type="date" name="next_followup_date" />
          <label className="checkbox-row">
            <input type="checkbox" name="alert_enabled" value="si" defaultChecked />
            Alertar próximo seguimiento
          </label>
          <textarea className="span-2" name="summary" placeholder="Resumen" required />
          <textarea className="span-2" name="commitments" placeholder="Compromisos" />
          <button type="submit">Registrar seguimiento</button>
        </form>
      </section>

      <section className="card">
        <h2>Historial de seguimientos</h2>
        <div className="activities-list">
          {followupsResp.data?.map((row) => (
            <article className="activity-item" key={row.id}>
              <p>
                <strong>{row.followup_type}</strong> - {row.date}
              </p>
              <p>Responsable: {(row.profiles as { full_name?: string } | null)?.full_name ?? "-"}</p>
              <p>Resumen: {row.summary}</p>
              <p>Compromisos: {row.commitments ?? "-"}</p>
              <p>
                Próximo seguimiento: {row.next_followup_date ?? "-"} | Alertas: {row.alert_enabled ? "Sí" : "No"}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
