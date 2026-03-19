import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUserRole } from "@/lib/auth/permissions";
import { getRoleHomePath, type AppRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

interface DashboardPageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

const modulesByRole: Record<AppRole, Array<{ label: string; href: string }>> = {
  administrador: [
    { label: "Clientes", href: "/dashboard/clientes" },
    { label: "Actividades", href: "/dashboard/actividades" },
    { label: "Proyectos técnicos", href: "/dashboard/proyectos-tecnicos" },
    { label: "APU / Presupuesto obra", href: "/dashboard/apu" },
    { label: "Almacén", href: "/dashboard/almacen" },
    { label: "Herramientas", href: "/dashboard/almacen/herramientas" },
    { label: "Requerimientos", href: "/dashboard/requerimientos" },
    { label: "Agenda operativa", href: "/dashboard/agenda-operativa" },
    { label: "Agenda tiempo real", href: "/dashboard/agenda-operativa/tiempo-real" },
    { label: "Mis tareas (técnico)", href: "/dashboard/mis-tareas" },
    { label: "Reporte de visita", href: "/dashboard/reporte-visita" },
    { label: "Cotizaciones", href: "/dashboard/cotizaciones" },
    { label: "APU / Presupuesto obra", href: "/dashboard/apu" },
    { label: "Órdenes de trabajo", href: "/dashboard/ordenes-trabajo" },
    { label: "Actas de satisfacción", href: "/dashboard/actas-satisfaccion" },
    { label: "Finanzas", href: "/dashboard/finanzas" },
    { label: "Casos consolidados", href: "/dashboard/casos" }
  ],
  asistente: [
    { label: "Requerimientos", href: "/dashboard/requerimientos" },
    { label: "Agenda operativa", href: "/dashboard/agenda-operativa" },
    { label: "Agenda tiempo real", href: "/dashboard/agenda-operativa/tiempo-real" },
    { label: "Cotizaciones", href: "/dashboard/cotizaciones" },
    { label: "Órdenes de trabajo", href: "/dashboard/ordenes-trabajo" },
    { label: "Actas de satisfacción", href: "/dashboard/actas-satisfaccion" },
    { label: "Actividades", href: "/dashboard/actividades" },
    { label: "Proyectos técnicos", href: "/dashboard/proyectos-tecnicos" },
    { label: "Almacén", href: "/dashboard/almacen" },
    { label: "Herramientas", href: "/dashboard/almacen/herramientas" },
    { label: "Finanzas", href: "/dashboard/finanzas" },
    { label: "Casos consolidados", href: "/dashboard/casos" }
  ],
  tecnico: [{ label: "Mis tareas (técnico)", href: "/dashboard/mis-tareas" }],
  contabilidad: [
    { label: "Finanzas", href: "/dashboard/finanzas" },
    { label: "Casos consolidados", href: "/dashboard/casos" }
  ],
  cliente: []
};

function currency(value: number) {
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function monthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

function sumByKeys(rows: Array<Record<string, unknown>> | null, keys: string[]) {
  if (!rows) {
    return 0;
  }

  return rows.reduce((sum, row) => {
    for (const key of keys) {
      const value = Number(row[key]);
      if (Number.isFinite(value)) {
        return sum + value;
      }
    }
    return sum;
  }, 0);
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const { userId, role } = await getCurrentUserRole();

  if (!userId) {
    redirect("/login?error=Debes iniciar sesión.");
  }

  if (!role) {
    redirect("/login?error=No se encontró perfil de rol para este usuario.");
  }

  if (role === "tecnico" || role === "contabilidad") {
    redirect(`${getRoleHomePath(role)}?ok=${encodeURIComponent("Redirección automática según tu rol.")}`);
  }

  const modules = modulesByRole[role];
  const showMetrics = role === "administrador";

  let casosAtendidosMes = 0;
  let cotizacionesGeneradas = 0;
  let cotizacionesAprobadas = 0;
  let facturasEmitidas = 0;
  let valorFacturadoMes = 0;
  let rentabilidadAproximada = 0;

  if (showMetrics) {
    const supabase = createAdminClient();
    const { startIso, endIso, startDate, endDate } = monthBounds();

    const [casosResp, cotizacionesResp, cotizacionesAprobadasResp, facturasResp, saldosResp, costosResp] =
      await Promise.all([
        supabase
          .from("requerimientos")
          .select("id", { count: "exact", head: true })
          .in("estado", ["visitado", "pendiente_cotizacion", "cotizado", "aprobado", "en_reparacion", "finalizado"])
          .gte("fecha_reporte", startDate)
          .lt("fecha_reporte", endDate),
        supabase
          .from("cotizaciones")
          .select("id", { count: "exact", head: true })
          .gte("fecha_cotizacion", startDate)
          .lt("fecha_cotizacion", endDate),
        supabase
          .from("cotizaciones")
          .select("id", { count: "exact", head: true })
          .eq("estado", "aprobada")
          .gte("fecha_cotizacion", startDate)
          .lt("fecha_cotizacion", endDate),
        supabase.from("invoices").select("amount_total,created_at").gte("created_at", startIso).lt("created_at", endIso),
        supabase.from("financial_records").select("saldo_por_cobrar"),
        supabase.from("financial_records").select("costo_total_asociado,utilidad_real")
      ]);

    casosAtendidosMes = casosResp.count ?? 0;
    cotizacionesGeneradas = cotizacionesResp.count ?? 0;
    cotizacionesAprobadas = cotizacionesAprobadasResp.count ?? 0;
    facturasEmitidas = facturasResp.data?.length ?? 0;
    valorFacturadoMes = sumByKeys(facturasResp.data as Array<Record<string, unknown>> | null, ["amount_total"]);
    const carteraTotal = sumByKeys(saldosResp.data as Array<Record<string, unknown>> | null, ["saldo_por_cobrar"]);
    const utilidadReal = sumByKeys(costosResp.data as Array<Record<string, unknown>> | null, ["utilidad_real"]);
    rentabilidadAproximada = utilidadReal - carteraTotal * 0.05;
  }

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Panel operativo de Creixer Manager.</p>
      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}

      {!showMetrics ? (
        <p className="feedback">Tu perfil no tiene acceso al dashboard gerencial completo ni a indicadores globales.</p>
      ) : null}

      {showMetrics ? (
        <section className="metrics-grid">
          <article className="card metric-card">
            <p className="metric-label">Casos atendidos (mes)</p>
            <p className="metric-value">{casosAtendidosMes}</p>
          </article>
          <article className="card metric-card">
            <p className="metric-label">Cotizaciones generadas</p>
            <p className="metric-value">{cotizacionesGeneradas}</p>
          </article>
          <article className="card metric-card">
            <p className="metric-label">Cotizaciones aprobadas</p>
            <p className="metric-value">{cotizacionesAprobadas}</p>
          </article>
          <article className="card metric-card">
            <p className="metric-label">Facturas emitidas</p>
            <p className="metric-value">{facturasEmitidas}</p>
          </article>
          <article className="card metric-card">
            <p className="metric-label">Valor facturado (mes)</p>
            <p className="metric-value">{currency(valorFacturadoMes)}</p>
          </article>
          <article className="card metric-card">
            <p className="metric-label">Rentabilidad aproximada</p>
            <p className="metric-value">{currency(rentabilidadAproximada)}</p>
          </article>
        </section>
      ) : null}

      <section className="module-grid">
        {modules.length === 0 ? <p className="feedback error">No hay módulos habilitados para este rol.</p> : null}
        {modules.map((module) => (
          <article className="card" key={module.label}>
            <h2 style={{ marginTop: 0 }}>{module.label}</h2>
            <Link href={module.href}>Abrir módulo</Link>
          </article>
        ))}
      </section>
    </main>
  );
}
