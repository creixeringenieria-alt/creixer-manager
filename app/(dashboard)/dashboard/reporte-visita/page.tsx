import Link from "next/link";

import { getCurrentUserRole, requirePageAccess } from "@/lib/auth/permissions";
import { RESULTADOS_VISITA } from "@/lib/operaciones/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { crearReporteVisitaAction } from "./actions";

interface ReportePageProps {
  searchParams: Promise<{ ok?: string; error?: string; agenda_id?: string }>;
}

function asDateTimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

export default async function ReporteVisitaPage({ searchParams }: ReportePageProps) {
  const role = await requirePageAccess(
    ["administrador", "tecnico"],
    "/dashboard",
    "Acceso denegado: tu rol no puede acceder al reporte de visita."
  );

  const params = await searchParams;
  const supabase = createAdminClient();
  const { userId } = await getCurrentUserRole();
  const tecnicoId = role === "tecnico" ? userId : null;

  let agendaQuery = supabase
    .from("agenda_operativa")
    .select("id, fecha_programada, franja_horaria, estado_agenda, requerimientos(codigo_requerimiento), profiles(full_name)")
    .in("estado_agenda", ["programada", "confirmada", "en_camino", "en_sitio"])
    .order("fecha_programada", { ascending: true });

  if (tecnicoId) {
    agendaQuery = agendaQuery.eq("tecnico_id", tecnicoId);
  }

  let reportesQuery = supabase
    .from("reportes_visita")
    .select("id, created_at, resultado_visita, requiere_cotizacion, se_reparo_en_sitio, agenda_operativa(fecha_programada, requerimientos(codigo_requerimiento), tecnico_id)")
    .order("created_at", { ascending: false })
    .limit(50);

  const [agendaResp, reportesResp] = await Promise.all([agendaQuery, reportesQuery]);
  const reportesFiltrados = tecnicoId
    ? (reportesResp.data ?? []).filter(
        (reporte) =>
          ((reporte.agenda_operativa as { tecnico_id?: string } | null)?.tecnico_id ?? null) === tecnicoId
      )
    : (reportesResp.data ?? []);

  const nowLocal = asDateTimeLocalValue(new Date());

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Reporte de visita</h1>
          <p>Registro en tiempo real del resultado técnico y evidencias.</p>
        </div>
        <Link href="/dashboard">Volver al dashboard</Link>
      </div>

      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}

      <section className="card">
        <h2>Nuevo reporte</h2>
        <form action={crearReporteVisitaAction} className="form-grid">
          <select name="agenda_id" required defaultValue={params.agenda_id ?? ""}>
            <option value="">Agenda</option>
            {agendaResp.data?.map((agenda) => (
              <option value={agenda.id} key={agenda.id}>
                {(agenda.requerimientos as { codigo_requerimiento?: string } | null)?.codigo_requerimiento} - {agenda.fecha_programada} {agenda.franja_horaria}
              </option>
            ))}
          </select>

          <input type="datetime-local" name="hora_llegada" defaultValue={nowLocal} />
          <input type="datetime-local" name="hora_salida" defaultValue={nowLocal} />

          <select name="resultado_visita" required>
            {RESULTADOS_VISITA.map((resultado) => (
              <option value={resultado} key={resultado}>
                {resultado}
              </option>
            ))}
          </select>

          <select name="requiere_cotizacion" defaultValue="si">
            <option value="si">Requiere cotización: Sí</option>
            <option value="no">Requiere cotización: No</option>
          </select>

          <select name="se_reparo_en_sitio" defaultValue="no">
            <option value="si">Se reparó en sitio: Sí</option>
            <option value="no">Se reparó en sitio: No</option>
          </select>

          <textarea name="diagnostico_tecnico" placeholder="Diagnóstico técnico" />
          <textarea name="actividades_recomendadas" placeholder="Actividades recomendadas" />
          <textarea name="observaciones" placeholder="Observaciones" />

          <label className="file-input-label">
            Fotos de evidencia
            <input type="file" name="fotos" multiple accept="image/*" />
          </label>

          <button type="submit">Registrar reporte</button>
        </form>
      </section>

      <section className="card">
        <h2>Últimos reportes</h2>
        {reportesResp.error ? <p className="feedback error">{reportesResp.error.message}</p> : null}

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Requerimiento</th>
                <th>Resultado</th>
                <th>Cotización</th>
                <th>Reparado en sitio</th>
              </tr>
            </thead>
            <tbody>
              {reportesFiltrados.map((reporte) => (
                <tr key={reporte.id}>
                  <td>{new Date(reporte.created_at).toLocaleString("es-CO")}</td>
                  <td>
                    {
                      ((reporte.agenda_operativa as { requerimientos?: { codigo_requerimiento?: string } } | null)
                        ?.requerimientos as { codigo_requerimiento?: string } | undefined)?.codigo_requerimiento ?? "-"
                    }
                  </td>
                  <td>{reporte.resultado_visita}</td>
                  <td>{reporte.requiere_cotizacion ? "Sí" : "No"}</td>
                  <td>{reporte.se_reparo_en_sitio ? "Sí" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
