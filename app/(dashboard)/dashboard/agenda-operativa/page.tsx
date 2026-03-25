import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/permissions";
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
  await requirePagePermission(
    "ver_casos",
    "/dashboard",
    "Acceso denegado: tu rol no puede acceder a agenda operativa."
  );

  const route = "/dashboard/agenda-operativa";
  const params = await searchParams;
  let hasQueryFailure = false;
  let supabase: ReturnType<typeof createAdminClient> | null = null;
  try {
    supabase = createAdminClient();
  } catch (error) {
    hasQueryFailure = true;
    console.error("[dashboard/agenda-operativa] createAdminClient failed", {
      route,
      query: "createAdminClient",
      variable: "NEXT_PUBLIC_SUPABASE_URL | SUPABASE_SERVICE_ROLE_KEY",
      error: error instanceof Error ? error.message : String(error)
    });
  }
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = toDateString(tomorrow);

  type QueryResponse<T> = { data: T[] | null; error: { message: string } | null };
  async function runQuery<T>({
    queryName,
    variable,
    execute
  }: {
    queryName: string;
    variable: string;
    execute: () => PromiseLike<QueryResponse<T>>;
  }): Promise<T[]> {
    if (!supabase) {
      return [];
    }
    try {
      const response = await execute();
      if (response.error) {
        hasQueryFailure = true;
        console.error("[dashboard/agenda-operativa] query failed", {
          route,
          query: queryName,
          variable,
          error: response.error.message
        });
        return [];
      }
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      hasQueryFailure = true;
      console.error("[dashboard/agenda-operativa] query threw exception", {
        route,
        query: queryName,
        variable,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  const [requerimientos, tecnicos, agenda, agendaTomorrow] = await Promise.all([
    runQuery({
      queryName: "requerimientos.list",
      variable: "requerimientos",
      execute: () =>
        supabase!
          .from("requerimientos")
          .select("id, codigo_requerimiento, descripcion, estado")
          .in("estado", ["pendiente", "agendado", "en_visita", "visitado", "pendiente_aprobacion"])
          .order("created_at", { ascending: false })
    }),
    runQuery({
      queryName: "profiles.tecnicos",
      variable: "profiles",
      execute: () => supabase!.from("profiles").select("id, full_name, role").eq("role", "tecnico").order("full_name")
    }),
    runQuery({
      queryName: "agenda_operativa.general",
      variable: "agenda_operativa",
      execute: () =>
        supabase!
          .from("agenda_operativa")
          .select(
            "id, fecha_programada, franja_horaria, tipo_visita, direccion, contacto, estado_agenda, requerimientos(codigo_requerimiento), profiles(full_name)"
          )
          .order("fecha_programada", { ascending: true })
          .limit(100)
    }),
    runQuery({
      queryName: "agenda_operativa.tomorrow",
      variable: "agenda_operativa",
      execute: () =>
        supabase!
          .from("agenda_operativa")
          .select(
            "id, fecha_programada, franja_horaria, direccion, estado_agenda, requerimientos(codigo_requerimiento), profiles(full_name)"
          )
          .eq("fecha_programada", tomorrowIso)
          .order("franja_horaria", { ascending: true })
    })
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
      {hasQueryFailure ? <p className="feedback error">No fue posible cargar agenda operativa</p> : null}

      <section className="card">
        <h2>Programar visita/reparación</h2>
        <form action={crearAgendaOperativaAction} className="form-grid">
          <select name="requerimiento_id" required>
            <option value="">Requerimiento</option>
            {requerimientos.map((item) => (
              <option value={item.id} key={item.id}>
                {item.codigo_requerimiento} - {item.descripcion.slice(0, 60)}
              </option>
            ))}
          </select>

          <select name="tecnico_id" required>
            <option value="">Técnico</option>
            {tecnicos.map((tecnico) => (
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
        {agendaTomorrow.length ? (
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
                {agendaTomorrow.map((row) => (
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

        <div className="agenda-list">
          {agenda.map((row) => (
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
