import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { ESTADOS_AGENDA, TIPOS_SERVICIO } from "@/lib/operaciones/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { actualizarEstadoAgendaAction, crearAgendaOperativaAction } from "./actions";

interface AgendaPageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function AgendaOperativaPage({ searchParams }: AgendaPageProps) {
  await requirePageAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede acceder a agenda operativa."
  );

  const params = await searchParams;
  const supabase = createAdminClient();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = toDateString(tomorrow);

  const [requerimientosResp, tecnicosResp, agendaResp, agendaTomorrowResp] = await Promise.all([
    supabase
      .from("requerimientos")
      .select("id, codigo_requerimiento, descripcion, estado")
      .in("estado", ["pendiente", "agendado", "en_visita", "visitado", "pendiente_aprobacion"]) 
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, role").eq("role", "tecnico").order("full_name"),
    supabase
      .from("agenda_operativa")
      .select(
        "id, fecha_programada, franja_horaria, tipo_visita, direccion, contacto, estado_agenda, requerimientos(codigo_requerimiento), profiles(full_name)"
      )
      .order("fecha_programada", { ascending: true })
      .limit(100),
    supabase
      .from("agenda_operativa")
      .select("id, fecha_programada, franja_horaria, direccion, estado_agenda, requerimientos(codigo_requerimiento), profiles(full_name)")
      .eq("fecha_programada", tomorrowIso)
      .order("franja_horaria", { ascending: true })
  ]);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Agenda operativa</h1>
          <p>Asignación de visitas y vista operativa del día siguiente.</p>
        </div>
        <div className="inline-form">
          <Link href="/dashboard">Volver al dashboard</Link>
          <Link href="/dashboard/agenda-operativa/tiempo-real">Ver tiempo real</Link>
        </div>
      </div>

      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}

      <section className="card">
        <h2>Programar visita/reparación</h2>
        <form action={crearAgendaOperativaAction} className="form-grid">
          <select name="requerimiento_id" required>
            <option value="">Requerimiento</option>
            {requerimientosResp.data?.map((item) => (
              <option value={item.id} key={item.id}>
                {item.codigo_requerimiento} - {item.descripcion.slice(0, 60)}
              </option>
            ))}
          </select>

          <select name="tecnico_id" required>
            <option value="">Técnico</option>
            {tecnicosResp.data?.map((tecnico) => (
              <option value={tecnico.id} key={tecnico.id}>
                {tecnico.full_name ?? tecnico.id}
              </option>
            ))}
          </select>

          <input type="date" name="fecha_programada" required />
          <input name="franja_horaria" placeholder="Franja (ej: 08:00-10:00)" required />

          <select name="tipo_visita" required>
            {TIPOS_SERVICIO.map((tipo) => (
              <option value={tipo} key={tipo}>
                {tipo}
              </option>
            ))}
          </select>

          <input name="direccion" placeholder="Dirección" required />
          <input name="contacto" placeholder="Contacto" />
          <textarea name="observaciones_logisticas" placeholder="Observaciones logísticas" />

          <select name="estado_agenda" defaultValue="programada">
            {ESTADOS_AGENDA.map((estado) => (
              <option value={estado} key={estado}>
                {estado}
              </option>
            ))}
          </select>

          <button type="submit">Crear agenda</button>
        </form>
      </section>

      <section className="card">
        <h2>Visitas asignadas para mañana ({tomorrowIso})</h2>
        {agendaTomorrowResp.data?.length ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Técnico</th>
                  <th>Código</th>
                  <th>Franja</th>
                  <th>Dirección</th>
                  <th>Estado agenda</th>
                </tr>
              </thead>
              <tbody>
                {agendaTomorrowResp.data?.map((row) => (
                  <tr key={row.id}>
                    <td>{(row.profiles as { full_name?: string } | null)?.full_name ?? "-"}</td>
                    <td>{(row.requerimientos as { codigo_requerimiento?: string } | null)?.codigo_requerimiento ?? "-"}</td>
                    <td>{row.franja_horaria}</td>
                    <td>{row.direccion}</td>
                    <td>{row.estado_agenda}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No hay visitas programadas para mañana.</p>
        )}
      </section>

      <section className="card">
        <h2>Agenda general</h2>
        {agendaResp.error ? <p className="feedback error">{agendaResp.error.message}</p> : null}

        <div className="agenda-list">
          {agendaResp.data?.map((row) => (
            <article className="agenda-item" key={row.id}>
              <p>
                <strong>{(row.requerimientos as { codigo_requerimiento?: string } | null)?.codigo_requerimiento}</strong> - {row.fecha_programada} {row.franja_horaria}
              </p>
              <p>
                Técnico: {(row.profiles as { full_name?: string } | null)?.full_name ?? "Sin asignar"} | Dirección: {row.direccion}
              </p>
              <form action={actualizarEstadoAgendaAction} className="inline-form">
                <input type="hidden" name="agenda_id" value={row.id} />
                <select name="estado_agenda" defaultValue={row.estado_agenda}>
                  {ESTADOS_AGENDA.map((estado) => (
                    <option value={estado} key={estado}>
                      {estado}
                    </option>
                  ))}
                </select>
                <button type="submit">Actualizar estado</button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
