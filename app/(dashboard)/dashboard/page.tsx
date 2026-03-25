import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUserPermissions, getCurrentUserRole } from "@/lib/auth/permissions";
import { getRoleHomePath } from "@/lib/auth/roles";
import { getDashboardCardsByRole, getVisibleDashboardRole } from "@/lib/navigation/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";

interface DashboardPageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

interface SupabaseQueryResult<T = any> {
  data: T;
  error: { message?: string; code?: string; details?: string; hint?: string } | null;
  count?: number | null;
}

const CLOSED_TASK_STATUSES = new Set(["completada", "finalizada", "cerrada", "cancelada"]);

function currency(value: number) {
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function dateIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const { userId, role } = await getCurrentUserRole();
  const permissionContext = await getCurrentUserPermissions();
  const visibleRole = getVisibleDashboardRole(role);
  console.info("[dashboard] auth context", {
    userId,
    role,
    normalizedRole: permissionContext.normalizedRole,
    permissionsCount: permissionContext.permissions.length
  });

  if (!userId) {
    console.warn("[dashboard] no session user, redirecting to /login");
    redirect("/login?error=Debes iniciar sesión.");
  }

  if (!visibleRole) {
    console.warn("[auth][dashboard] authenticated user without visible role", { userId });
    redirect("/acceso-incompleto?error=No%20se%20encontr%C3%B3%20perfil%20de%20rol%20para%20este%20usuario.");
  }

  if (visibleRole === "tecnico" || visibleRole === "cliente_inmobiliaria") {
    redirect(`${getRoleHomePath(role)}?ok=${encodeURIComponent("Redirección automática según tu rol.")}`);
  }

  const modules = getDashboardCardsByRole(role);
  const showExecutive =
    visibleRole === "super_admin" ||
    visibleRole === "gerente_operativo" ||
    visibleRole === "administrativo" ||
    visibleRole === "contable" ||
    visibleRole === "lider_operativo";

  const today = new Date();
  const todayDate = dateIso(today);

  let kpis = {
    casosAbiertos: 0,
    casosVencidos: 0,
    visitasHoy: 0,
    cotizacionesPendientes: 0,
    ordenesEjecucion: 0,
    facturasPendientes: 0,
    carteraPorCobrar: 0,
    proyectosCriticos: 0
  };
  let casosRecientes: any[] = [];
  let agendaHoy: any[] = [];
  let proyectosRiesgo: any[] = [];
  let dashboardDataError: string | null = null;
  let dashboardFailedQueries: string[] = [];

  if (showExecutive) {
    try {
      const supabase = createAdminClient();
      console.info("[dashboard] loading executive kpis");
      const [financialResp, overdueAgendaResp, visitasHoyResp, cotizacionesResp, ordenesResp, facturasResp, casosResp, agendaResp, projectsResp, overdueTasksResp] =
        await Promise.all([
          supabase
            .from("financial_records")
            .select(
              "id, estado_financiero, saldo_por_cobrar, updated_at, case_type, requerimientos(codigo_requerimiento), technical_projects(name)"
            )
            .order("updated_at", { ascending: false })
            .limit(300),
          supabase
            .from("agenda_operativa")
            .select("id", { count: "exact", head: true })
            .lt("fecha_programada", todayDate)
            .not("estado_agenda", "in", "(cerrada,no_efectiva)"),
          supabase
            .from("agenda_operativa")
            .select("id", { count: "exact", head: true })
            .eq("fecha_programada", todayDate),
          supabase
            .from("cotizaciones")
            // Evita dependencia de enums exactos entre ambientes.
            .select("id, estado")
            .order("created_at", { ascending: false })
            .limit(500),
          supabase
            .from("work_orders")
            .select("id", { count: "exact", head: true })
            .in("status", ["programada", "en_progreso"]),
          supabase.from("invoices").select("id, amount_pending, status").gt("amount_pending", 0),
          supabase
            .from("financial_records")
            .select(
              "id, updated_at, estado_financiero, case_type, requerimientos(codigo_requerimiento), technical_projects(name), valor_aprobado"
            )
            .order("updated_at", { ascending: false })
            .limit(8),
          supabase
            .from("agenda_operativa")
            .select(
              // Evita joins de FK ambiguos; el nombre se resuelve luego con consulta separada.
              "id, fecha_programada, franja_horaria, tipo_visita, estado_agenda, tecnico_id, requerimiento_id"
            )
            .eq("fecha_programada", todayDate)
            .order("franja_horaria", { ascending: true })
            .limit(8),
          supabase
            .from("technical_projects")
            .select("id, name, status, priority, planned_end_date, clients(name)")
            .order("updated_at", { ascending: false })
            .limit(80),
          supabase
            .from("technical_project_tasks")
            .select("id, project_id, planned_end_date, status")
            .lt("planned_end_date", todayDate)
        ]);

      const agendaRows = (agendaResp.data ?? []) as Array<{
        id: string;
        fecha_programada: string;
        franja_horaria: string | null;
        tipo_visita: string | null;
        estado_agenda: string;
        tecnico_id: string | null;
        requerimiento_id: string | null;
      }>;
      const tecnicoIds = Array.from(new Set(agendaRows.map((row) => row.tecnico_id).filter(Boolean))) as string[];
      const requerimientoIds = Array.from(new Set(agendaRows.map((row) => row.requerimiento_id).filter(Boolean))) as string[];
      const [tecnicosResp, requerimientosResp] = await Promise.all([
        tecnicoIds.length > 0
          ? supabase.from("profiles").select("id, full_name").in("id", tecnicoIds)
          : Promise.resolve({ data: [], error: null }),
        requerimientoIds.length > 0
          ? supabase.from("requerimientos").select("id, codigo_requerimiento").in("id", requerimientoIds)
          : Promise.resolve({ data: [], error: null })
      ]);

      const tecnicoMap = new Map((tecnicosResp.data ?? []).map((row: any) => [row.id, row.full_name ?? "-"]));
      const requerimientoMap = new Map((requerimientosResp.data ?? []).map((row: any) => [row.id, row.codigo_requerimiento ?? "-"]));
      const queryMap: Array<{ name: string; result: SupabaseQueryResult }> = [
        { name: "financial_kpi_base", result: financialResp as SupabaseQueryResult },
        { name: "agenda_vencida_count", result: overdueAgendaResp as SupabaseQueryResult },
        { name: "agenda_hoy_count", result: visitasHoyResp as SupabaseQueryResult },
        { name: "cotizaciones_rows", result: cotizacionesResp as SupabaseQueryResult },
        { name: "ordenes_en_ejecucion_count", result: ordenesResp as SupabaseQueryResult },
        { name: "facturas_pendientes_rows", result: facturasResp as SupabaseQueryResult },
        { name: "casos_recientes_rows", result: casosResp as SupabaseQueryResult },
        { name: "agenda_hoy_rows", result: agendaResp as SupabaseQueryResult },
        { name: "agenda_tecnicos_rows", result: tecnicosResp as SupabaseQueryResult },
        { name: "agenda_requerimientos_rows", result: requerimientosResp as SupabaseQueryResult },
        { name: "proyectos_rows", result: projectsResp as SupabaseQueryResult },
        { name: "proyectos_tareas_vencidas_rows", result: overdueTasksResp as SupabaseQueryResult }
      ];

      const failed = queryMap
        .filter((entry) => !!entry.result.error)
        .map((entry) => ({
          name: entry.name,
          message: entry.result.error?.message ?? "unknown_error",
          code: entry.result.error?.code ?? "n/a",
          hint: entry.result.error?.hint ?? "n/a",
          details: entry.result.error?.details ?? "n/a"
        }));
      if (failed.length > 0) {
        dashboardFailedQueries = failed.map((item) => item.name);
        console.error("[dashboard] failed KPI queries", failed);
        dashboardDataError = `No se pudo cargar parte de indicadores. Queries fallidas: ${dashboardFailedQueries.join(", ")}`;
      }

      const financialRows = financialResp.data ?? [];
      const projects = projectsResp.data ?? [];
      const overdueTaskRows = (overdueTasksResp.data ?? []).filter(
        (row: any) => !CLOSED_TASK_STATUSES.has(String(row.status ?? "").toLowerCase())
      );
      const overdueByProject = overdueTaskRows.reduce(
        (acc, row: any) => {
          const key = String(row.project_id ?? "");
          if (!key) return acc;
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const cartera = financialRows.reduce((sum: number, row: any) => sum + Number(row.saldo_por_cobrar ?? 0), 0);
      const abiertos = financialRows.filter((row: any) => row.estado_financiero !== "cerrado").length;
      const criticos = projects.filter((project: any) => {
        const overdueCount = overdueByProject[project.id] ?? 0;
        const vencido = typeof project.planned_end_date === "string" && project.planned_end_date < todayDate;
        return overdueCount > 0 || vencido || project.priority === "alta";
      });

      const cotizacionesPendientes = (cotizacionesResp.data ?? []).filter((row: any) => {
        const estado = String(row.estado ?? "").toLowerCase();
        return estado !== "aprobada" && estado !== "rechazada" && estado !== "vencida";
      }).length;

      kpis = {
        casosAbiertos: abiertos,
        casosVencidos: (overdueAgendaResp.count ?? 0) + overdueTaskRows.length,
        visitasHoy: visitasHoyResp.count ?? 0,
        cotizacionesPendientes,
        ordenesEjecucion: ordenesResp.count ?? 0,
        facturasPendientes: facturasResp.data?.length ?? 0,
        carteraPorCobrar: cartera,
        proyectosCriticos: criticos.length
      };

      casosRecientes = (casosResp.data ?? []).map((row: any) => ({
        id: row.id,
        nombre:
          (row.requerimientos as { codigo_requerimiento?: string } | null)?.codigo_requerimiento ??
          (row.technical_projects as { name?: string } | null)?.name ??
          row.id,
        tipo: row.case_type,
        estado: row.estado_financiero,
        valor: Number(row.valor_aprobado ?? 0),
        updated_at: row.updated_at
      }));

      agendaHoy = agendaRows.map((row: any) => ({
        id: row.id,
        hora: row.franja_horaria ?? "-",
        tipo: row.tipo_visita ?? "-",
        estado: row.estado_agenda,
        responsable: row.tecnico_id ? tecnicoMap.get(row.tecnico_id) ?? "-" : "-",
        caso: row.requerimiento_id ? requerimientoMap.get(row.requerimiento_id) ?? "-" : "-"
      }));

      proyectosRiesgo = criticos.slice(0, 8).map((project: any) => ({
        id: project.id,
        nombre: project.name,
        cliente: (project.clients as { name?: string } | null)?.name ?? "-",
        estado: project.status,
        prioridad: project.priority,
        fecha_fin: project.planned_end_date ?? "-",
        tareas_vencidas: overdueByProject[project.id] ?? 0
      }));
    } catch (error) {
      console.error("[dashboard] fatal KPI load error:", error);
      dashboardDataError =
        "No fue posible cargar indicadores del dashboard. Verifica configuración de Supabase (service role, tablas y permisos).";
    }
  }

  return (
    <main>
      <h1>Dashboard gerencial</h1>
      <p>Visión ejecutiva de casos, operación, comercial, proyectos y finanzas.</p>
      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}
      {dashboardDataError ? <p className="feedback error">{dashboardDataError}</p> : null}
      {dashboardFailedQueries.length > 0 ? (
        <p className="feedback error">
          Error técnico puntual en: <strong>{dashboardFailedQueries.join(", ")}</strong>
        </p>
      ) : null}

      {!showExecutive ? (
        <p className="feedback">Tu perfil no tiene acceso al dashboard gerencial. Usa Mis tareas para operación diaria.</p>
      ) : null}

      {showExecutive ? (
        <section className="metrics-grid">
          <article className="card metric-card">
            <p className="metric-label">Casos abiertos</p>
            <p className="metric-value">{kpis.casosAbiertos}</p>
          </article>
          <article className="card metric-card">
            <p className="metric-label">Casos vencidos</p>
            <p className="metric-value">{kpis.casosVencidos}</p>
          </article>
          <article className="card metric-card">
            <p className="metric-label">Visitas de hoy</p>
            <p className="metric-value">{kpis.visitasHoy}</p>
          </article>
          <article className="card metric-card">
            <p className="metric-label">Cotizaciones pendientes</p>
            <p className="metric-value">{kpis.cotizacionesPendientes}</p>
          </article>
          <article className="card metric-card">
            <p className="metric-label">Órdenes en ejecución</p>
            <p className="metric-value">{kpis.ordenesEjecucion}</p>
          </article>
          <article className="card metric-card">
            <p className="metric-label">Facturas pendientes</p>
            <p className="metric-value">{kpis.facturasPendientes}</p>
          </article>
          <article className="card metric-card">
            <p className="metric-label">Cartera por cobrar</p>
            <p className="metric-value">{currency(kpis.carteraPorCobrar)}</p>
          </article>
          <article className="card metric-card">
            <p className="metric-label">Proyectos críticos</p>
            <p className="metric-value">{kpis.proyectosCriticos}</p>
          </article>
        </section>
      ) : null}

      {showExecutive ? (
        <section className="split-grid">
          <article className="card">
            <h2 style={{ marginTop: 0 }}>Casos recientes</h2>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Caso</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {casosRecientes.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link href={`/dashboard/casos/${row.id}`}>{row.nombre}</Link>
                      </td>
                      <td>{row.tipo}</td>
                      <td>{row.estado}</td>
                      <td>{currency(row.valor)}</td>
                    </tr>
                  ))}
                  {casosRecientes.length === 0 ? (
                    <tr>
                      <td colSpan={4}>Sin datos recientes.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>

          <article className="card">
            <h2 style={{ marginTop: 0 }}>Agenda del día</h2>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Caso</th>
                    <th>Tipo</th>
                    <th>Responsable</th>
                  </tr>
                </thead>
                <tbody>
                  {agendaHoy.map((row) => (
                    <tr key={row.id}>
                      <td>{row.hora}</td>
                      <td>{row.caso}</td>
                      <td>{row.tipo}</td>
                      <td>{row.responsable}</td>
                    </tr>
                  ))}
                  {agendaHoy.length === 0 ? (
                    <tr>
                      <td colSpan={4}>No hay visitas para hoy ({todayDate}).</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}

      {showExecutive ? (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Proyectos en riesgo</h2>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Proyecto</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Prioridad</th>
                  <th>Fin planeado</th>
                  <th>Tareas vencidas</th>
                </tr>
              </thead>
              <tbody>
                {proyectosRiesgo.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/dashboard/proyectos-tecnicos/${row.id}`}>{row.nombre}</Link>
                    </td>
                    <td>{row.cliente}</td>
                    <td>{row.estado}</td>
                    <td>{row.prioridad}</td>
                    <td>{row.fecha_fin}</td>
                    <td>{row.tareas_vencidas}</td>
                  </tr>
                ))}
                {proyectosRiesgo.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No hay proyectos críticos detectados hoy.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!showExecutive ? (
        <section className="module-grid">
          {modules.length === 0 ? <p className="feedback error">No hay módulos habilitados para este rol.</p> : null}
          {modules.map((module) => (
            <article className="card" key={module.id}>
              <h2 style={{ marginTop: 0 }}>{module.label}</h2>
              <Link href={module.href}>Abrir módulo</Link>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}
