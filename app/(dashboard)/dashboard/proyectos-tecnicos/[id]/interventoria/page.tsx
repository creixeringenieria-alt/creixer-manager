import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  crearActaInterventoriaAction,
  crearAvanceFinancieroInterventoriaAction,
  crearAvanceFisicoInterventoriaAction,
  crearCalidadInterventoriaAction,
  crearRegistroInterventoriaAction,
  crearRequerimientoContratistaAction,
  crearSstInterventoriaAction,
  crearVisitaInterventoriaAction,
  guardarContratoInterventoriaAction
} from "../../actions";

interface InterventoriaPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}

export default async function InterventoriaPage({ params, searchParams }: InterventoriaPageProps) {
  await requirePageAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede acceder a interventoría."
  );

  const { id } = await params;
  const query = await searchParams;
  const supabase = createAdminClient();

  const [projectResp, usersResp, contractResp, recordsResp, visitsResp, physicalResp, financialResp, qualityResp, sstResp, actasResp, reqResp] =
    await Promise.all([
      supabase.from("technical_projects").select("id, name, type, location").eq("id", id).maybeSingle(),
      supabase.from("profiles").select("id, full_name").order("full_name"),
      supabase.from("interventoria_contracts").select("*").eq("project_id", id).maybeSingle(),
      supabase
        .from("interventoria_records")
        .select("id, record_type, title, status, due_date, profiles(full_name)")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("interventoria_site_visits")
        .select("id, visit_date, observed_activities, progress_percent, observations, commitments, profiles(full_name)")
        .eq("project_id", id)
        .order("visit_date", { ascending: false }),
      supabase
        .from("interventoria_physical_progress")
        .select("id, activity_name, unit, quantity_programmed, quantity_executed, progress_percent")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("interventoria_financial_progress")
        .select("id, activity_name, value_programmed, value_executed, value_pending")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("interventoria_quality_records")
        .select("id, inspection_type, status, observations, corrective_actions")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("interventoria_sst_records")
        .select("id, observation, non_compliance, corrective_action, status")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("interventoria_actas")
        .select("id, acta_type, title, meeting_date, summary")
        .eq("project_id", id)
        .order("meeting_date", { ascending: false }),
      supabase
        .from("interventoria_contractor_requirements")
        .select("id, description, request_date, due_date, status, support_url, profiles(full_name)")
        .eq("project_id", id)
        .order("request_date", { ascending: false })
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
          <h1>Interventoría integral</h1>
          <p>
            Proyecto: <strong>{projectResp.data.name}</strong> ({projectResp.data.type})
          </p>
        </div>
        <Link href={`/dashboard/proyectos-tecnicos/${id}`}>Volver al proyecto</Link>
      </div>

      {query.error ? <p className="feedback error">{query.error}</p> : null}
      {query.ok ? <p className="feedback success">{query.ok}</p> : null}

      <section className="card">
        <h2>Datos generales del contrato/obra</h2>
        <form action={guardarContratoInterventoriaAction} className="form-grid">
          <input type="hidden" name="return_path" value={`/dashboard/proyectos-tecnicos/${id}/interventoria`} />
          <input type="hidden" name="project_id" value={id} />
          <input name="contractor_name" placeholder="Contratista" defaultValue={contractResp.data?.contractor_name ?? ""} required />
          <input
            name="contract_object"
            placeholder="Objeto contractual"
            defaultValue={contractResp.data?.contract_object ?? ""}
            required
          />
          <input name="location" placeholder="Ubicación" defaultValue={contractResp.data?.location ?? projectResp.data.location ?? ""} />
          <input type="number" min="0" name="contract_term_days" placeholder="Plazo (días)" defaultValue={contractResp.data?.contract_term_days ?? ""} />
          <input type="date" name="contract_start_date" defaultValue={contractResp.data?.contract_start_date ?? ""} />
          <input type="date" name="contract_end_date" defaultValue={contractResp.data?.contract_end_date ?? ""} />
          <input type="number" step="0.01" min="0" name="contract_value" placeholder="Valor contrato" defaultValue={contractResp.data?.contract_value ?? 0} />
          <select name="interventoria_responsible_id" defaultValue={contractResp.data?.interventoria_responsible_id ?? ""}>
            <option value="">Responsable interventoría</option>
            {usersResp.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name ?? u.id}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={contractResp.data?.status ?? "planeado"}>
            <option value="planeado">planeado</option>
            <option value="en_ejecucion">en_ejecucion</option>
            <option value="suspendido">suspendido</option>
            <option value="cerrado">cerrado</option>
            <option value="cancelado">cancelado</option>
          </select>
          <button type="submit">Guardar datos contractuales</button>
        </form>
      </section>

      <section className="card">
        <h2>Registro de visitas de obra</h2>
        <form action={crearVisitaInterventoriaAction} className="form-grid">
          <input type="hidden" name="return_path" value={`/dashboard/proyectos-tecnicos/${id}/interventoria`} />
          <input type="hidden" name="project_id" value={id} />
          <input type="date" name="visit_date" />
          <select name="responsible_user_id">
            <option value="">Responsable</option>
            {usersResp.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name ?? u.id}
              </option>
            ))}
          </select>
          <input type="number" min="0" max="100" step="1" name="progress_percent" placeholder="% avance observado" />
          <textarea className="span-2" name="observed_activities" placeholder="Actividades observadas" required />
          <textarea className="span-2" name="observations" placeholder="Observaciones" />
          <textarea className="span-2" name="commitments" placeholder="Compromisos" />
          <button type="submit">Registrar visita</button>
        </form>
        <div className="table-wrapper" style={{ marginTop: "1rem" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Responsable</th>
                <th>Avance</th>
                <th>Actividades</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {visitsResp.data?.map((v) => (
                <tr key={v.id}>
                  <td>{v.visit_date}</td>
                  <td>{(v.profiles as { full_name?: string } | null)?.full_name ?? "-"}</td>
                  <td>{Number(v.progress_percent)}%</td>
                  <td>{v.observed_activities}</td>
                  <td>{v.observations ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Avance físico y financiero</h2>
        <div className="split-grid">
          <form action={crearAvanceFisicoInterventoriaAction} className="form-grid">
            <input type="hidden" name="return_path" value={`/dashboard/proyectos-tecnicos/${id}/interventoria`} />
            <input type="hidden" name="project_id" value={id} />
            <input name="activity_name" placeholder="Actividad física" required />
            <input name="unit" placeholder="Unidad" required />
            <input type="number" step="0.0001" name="quantity_programmed" placeholder="Cantidad programada" />
            <input type="number" step="0.0001" name="quantity_executed" placeholder="Cantidad ejecutada" />
            <input type="number" min="0" max="100" step="1" name="progress_percent" placeholder="% avance" />
            <textarea className="span-2" name="notes" placeholder="Notas" />
            <button type="submit">Registrar avance físico</button>
          </form>
          <form action={crearAvanceFinancieroInterventoriaAction} className="form-grid">
            <input type="hidden" name="return_path" value={`/dashboard/proyectos-tecnicos/${id}/interventoria`} />
            <input type="hidden" name="project_id" value={id} />
            <input name="activity_name" placeholder="Actividad financiera" required />
            <input type="number" step="0.01" name="value_programmed" placeholder="Valor programado" />
            <input type="number" step="0.01" name="value_executed" placeholder="Valor ejecutado" />
            <input type="number" step="0.01" name="value_pending" placeholder="Valor pendiente" />
            <textarea className="span-2" name="notes" placeholder="Notas" />
            <button type="submit">Registrar avance financiero</button>
          </form>
        </div>
      </section>

      <section className="card">
        <h2>Calidad y SST</h2>
        <div className="split-grid">
          <form action={crearCalidadInterventoriaAction} className="form-grid">
            <input type="hidden" name="return_path" value={`/dashboard/proyectos-tecnicos/${id}/interventoria`} />
            <input type="hidden" name="project_id" value={id} />
            <input name="inspection_type" placeholder="Inspección / ensayo" required />
            <input name="test_reference" placeholder="Referencia ensayo" />
            <select name="status" defaultValue="conforme">
              <option value="conforme">conforme</option>
              <option value="no_conforme">no_conforme</option>
              <option value="en_seguimiento">en_seguimiento</option>
              <option value="cerrado">cerrado</option>
            </select>
            <textarea className="span-2" name="observations" placeholder="Observaciones" />
            <textarea className="span-2" name="corrective_actions" placeholder="Acciones correctivas" />
            <button type="submit">Registrar calidad</button>
          </form>
          <form action={crearSstInterventoriaAction} className="form-grid">
            <input type="hidden" name="return_path" value={`/dashboard/proyectos-tecnicos/${id}/interventoria`} />
            <input type="hidden" name="project_id" value={id} />
            <textarea className="span-2" name="observation" placeholder="Observación SST" required />
            <textarea className="span-2" name="non_compliance" placeholder="Incumplimiento" />
            <textarea className="span-2" name="corrective_action" placeholder="Medida correctiva" />
            <select name="status" defaultValue="abierta">
              <option value="abierta">abierta</option>
              <option value="en_gestion">en_gestion</option>
              <option value="cerrada">cerrada</option>
            </select>
            <button type="submit">Registrar SST</button>
          </form>
        </div>
      </section>

      <section className="card">
        <h2>Actas y requerimientos al contratista</h2>
        <div className="split-grid">
          <form action={crearActaInterventoriaAction} className="form-grid">
            <input type="hidden" name="return_path" value={`/dashboard/proyectos-tecnicos/${id}/interventoria`} />
            <input type="hidden" name="project_id" value={id} />
            <select name="acta_type" defaultValue="comite">
              <option value="inicio">inicio</option>
              <option value="comite">comite</option>
              <option value="visita">visita</option>
              <option value="suspension">suspension</option>
              <option value="reinicio">reinicio</option>
              <option value="cierre">cierre</option>
              <option value="parcial">parcial</option>
            </select>
            <input name="title" placeholder="Título acta" required />
            <input type="date" name="meeting_date" />
            <textarea className="span-2" name="summary" placeholder="Resumen" />
            <textarea className="span-2" name="commitments" placeholder="Compromisos" />
            <input name="file_url" placeholder="URL soporte acta" />
            <button type="submit">Registrar acta</button>
          </form>
          <form action={crearRequerimientoContratistaAction} className="form-grid">
            <input type="hidden" name="return_path" value={`/dashboard/proyectos-tecnicos/${id}/interventoria`} />
            <input type="hidden" name="project_id" value={id} />
            <textarea className="span-2" name="description" placeholder="Descripción requerimiento" required />
            <input type="date" name="request_date" />
            <select name="responsible_user_id">
              <option value="">Responsable</option>
              {usersResp.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name ?? u.id}
                </option>
              ))}
            </select>
            <input type="date" name="due_date" />
            <select name="status" defaultValue="abierto">
              <option value="abierto">abierto</option>
              <option value="en_proceso">en_proceso</option>
              <option value="respondido">respondido</option>
              <option value="cerrado">cerrado</option>
              <option value="vencido">vencido</option>
            </select>
            <input name="support_url" placeholder="URL soporte" />
            <textarea className="span-2" name="close_notes" placeholder="Notas de cierre" />
            <button type="submit">Registrar requerimiento</button>
          </form>
        </div>
      </section>

      <section className="card">
        <h2>Tableros de seguimiento interventoría</h2>
        <div className="split-grid">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Registro</th>
                  <th>Estado</th>
                  <th>Vence</th>
                </tr>
              </thead>
              <tbody>
                {recordsResp.data?.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.record_type} - {row.title}
                    </td>
                    <td>{row.status}</td>
                    <td>{row.due_date ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Título/Descripción</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {actasResp.data?.map((row) => (
                  <tr key={`acta-${row.id}`}>
                    <td>acta-{row.acta_type}</td>
                    <td>{row.title}</td>
                    <td>{row.meeting_date}</td>
                  </tr>
                ))}
                {qualityResp.data?.map((row) => (
                  <tr key={`qual-${row.id}`}>
                    <td>calidad</td>
                    <td>{row.inspection_type}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
                {sstResp.data?.map((row) => (
                  <tr key={`sst-${row.id}`}>
                    <td>sst</td>
                    <td>{row.observation.slice(0, 80)}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
                {reqResp.data?.map((row) => (
                  <tr key={`req-${row.id}`}>
                    <td>req contratista</td>
                    <td>{row.description.slice(0, 80)}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
