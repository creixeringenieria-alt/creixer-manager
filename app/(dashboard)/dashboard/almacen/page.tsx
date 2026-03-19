import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

interface AlmacenDashboardPageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

function monthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

function money(value: number) {
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export default async function AlmacenDashboardPage({ searchParams }: AlmacenDashboardPageProps) {
  await requirePageAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede acceder al módulo de almacén."
  );

  const params = await searchParams;
  const supabase = createAdminClient();
  const { startIso, endIso } = monthBounds();

  const [itemsResp, toolsResp, movementsResp, topCasesResp] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id, name, stock_current, stock_min")
      .eq("active", true)
      .order("name"),
    supabase.from("tools").select("id, operational_status").eq("active", true),
    supabase
      .from("inventory_movements")
      .select("id, movement_type, total_cost, case_id, requerimientos(codigo_requerimiento)")
      .gte("created_at", startIso)
      .lt("created_at", endIso),
    supabase
      .from("inventory_movements")
      .select("case_id, total_cost, requerimientos(codigo_requerimiento)")
      .eq("movement_type", "salida_caso")
      .gte("created_at", startIso)
      .lt("created_at", endIso)
  ]);

  const lowStockItems = (itemsResp.data ?? []).filter((item) => Number(item.stock_current) <= Number(item.stock_min));
  const herramientasDisponibles = (toolsResp.data ?? []).filter((tool) => tool.operational_status === "disponible").length;
  const herramientasAsignadas = (toolsResp.data ?? []).filter((tool) => tool.operational_status === "asignada").length;
  const herramientasMantenimiento = (toolsResp.data ?? []).filter((tool) => tool.operational_status === "mantenimiento").length;

  const costoMaterialMes = (movementsResp.data ?? [])
    .filter((row) => row.movement_type === "salida_caso")
    .reduce((sum, row) => sum + Number(row.total_cost ?? 0), 0);

  const casesMap = new Map<string, { codigo: string; total: number }>();
  for (const row of topCasesResp.data ?? []) {
    if (!row.case_id) {
      continue;
    }
    const prev = casesMap.get(row.case_id);
    const codigo =
      (row.requerimientos as { codigo_requerimiento?: string } | null)?.codigo_requerimiento ?? row.case_id.slice(0, 8);
    const total = (prev?.total ?? 0) + Number(row.total_cost ?? 0);
    casesMap.set(row.case_id, { codigo, total });
  }
  const topCases = Array.from(casesMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Almacén y herramientas</h1>
          <p>Control operativo de materiales consumibles y equipos.</p>
        </div>
        <div className="inline-form">
          <Link href="/dashboard">Volver al dashboard</Link>
          <Link href="/dashboard/almacen/materiales">Materiales</Link>
          <Link href="/dashboard/almacen/herramientas">Herramientas</Link>
          <Link href="/dashboard/almacen/qr">Vista QR</Link>
        </div>
      </div>

      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}

      <section className="metrics-grid">
        <article className="card metric-card">
          <p className="metric-label">Materiales con stock bajo</p>
          <p className="metric-value">{lowStockItems.length}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Herramientas disponibles</p>
          <p className="metric-value">{herramientasDisponibles}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Herramientas asignadas</p>
          <p className="metric-value">{herramientasAsignadas}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Herramientas en mantenimiento</p>
          <p className="metric-value">{herramientasMantenimiento}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Costo materiales del mes</p>
          <p className="metric-value">{money(costoMaterialMes)}</p>
        </article>
      </section>

      <section className="card">
        <h2>Materiales con stock bajo</h2>
        {lowStockItems.length === 0 ? (
          <p>No hay materiales en nivel crítico.</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Stock actual</th>
                  <th>Stock mínimo</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{Number(item.stock_current)}</td>
                    <td>{Number(item.stock_min)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Casos con mayor consumo (mes)</h2>
        {topCases.length === 0 ? (
          <p>No hay consumos de casos en el periodo.</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Caso</th>
                  <th>Total consumo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {topCases.map((item) => (
                  <tr key={item.id}>
                    <td>{item.codigo}</td>
                    <td>{money(item.total)}</td>
                    <td>
                      <Link href={`/dashboard/requerimientos/${item.id}/recursos`}>Ver recursos</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
