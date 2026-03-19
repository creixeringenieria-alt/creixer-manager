import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  actualizarFichaFinancieraAction,
  crearAnticipoAction,
  crearFacturaAction,
  crearNotaCreditoAction,
  registrarPagoFacturaAction
} from "./actions";

interface FinanzasPageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

function money(value: number) {
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export default async function FinanzasPage({ searchParams }: FinanzasPageProps) {
  await requirePageAccess(
    ["administrador", "contabilidad", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede acceder a finanzas."
  );

  const params = await searchParams;
  const supabase = createAdminClient();

  const [financialResp, invoicesResp, advancesResp] = await Promise.all([
    supabase
      .from("financial_records")
      .select(
        "id, case_type, requerimiento_id, technical_project_id, valor_cotizado, valor_aprobado, valor_facturado, valor_cobrado, saldo_por_facturar, saldo_por_cobrar, costo_total_asociado, utilidad_estimada, utilidad_real, estado_financiero, requiere_anticipo, porcentaje_anticipo, valor_anticipo_solicitado, valor_anticipo_recibido, fecha_solicitud_anticipo, fecha_recepcion_anticipo, requerimientos(codigo_requerimiento), technical_projects(name)"
      )
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("invoices")
      .select("id, invoice_number, due_at, amount_total, amount_pending, status, financial_records(id, case_type)")
      .order("issued_at", { ascending: false })
      .limit(200),
    supabase
      .from("advance_requests")
      .select("id, financial_record_id, status, amount_requested, amount_received")
      .order("created_at", { ascending: false })
      .limit(200)
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const financialRows = financialResp.data ?? [];
  const invoices = invoicesResp.data ?? [];
  const advances = advancesResp.data ?? [];

  const executedWithoutInvoice = financialRows.filter(
    (row) => row.estado_financiero === "en_ejecucion" && Number(row.valor_facturado) === 0
  );
  const advancePending = advances.filter((row) => row.status === "solicitado" || row.status === "aprobado");
  const overdueInvoices = invoices.filter((row) => row.due_at && row.due_at < today && Number(row.amount_pending) > 0);
  const carteraPendiente = financialRows.filter((row) => Number(row.saldo_por_cobrar) > 0);
  const lowProfitCases = financialRows.filter((row) => Number(row.utilidad_real) < 0 || Number(row.utilidad_estimada) < 0);
  const totalFacturado = financialRows.reduce((sum, row) => sum + Number(row.valor_facturado ?? 0), 0);
  const totalCobrado = financialRows.reduce((sum, row) => sum + Number(row.valor_cobrado ?? 0), 0);
  const totalAprobado = financialRows.reduce((sum, row) => sum + Number(row.valor_aprobado ?? 0), 0);
  const totalUtilidadEstimada = financialRows.reduce((sum, row) => sum + Number(row.utilidad_estimada ?? 0), 0);
  const totalUtilidadReal = financialRows.reduce((sum, row) => sum + Number(row.utilidad_real ?? 0), 0);
  const porcentajeCobroSobreFacturado = totalFacturado > 0 ? (totalCobrado / totalFacturado) * 100 : 0;
  const porcentajeFacturadoSobreAprobado = totalAprobado > 0 ? (totalFacturado / totalAprobado) * 100 : 0;

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Control financiero central</h1>
          <p>Expediente financiero único por caso/proyecto con facturación, anticipos, cartera y rentabilidad.</p>
        </div>
        <Link href="/dashboard">Volver al dashboard</Link>
      </div>

      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}

      <section className="metrics-grid">
        <article className="card metric-card">
          <p className="metric-label">Ejecutados sin facturar</p>
          <p className="metric-value">{executedWithoutInvoice.length}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Anticipos pendientes</p>
          <p className="metric-value">{advancePending.length}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Facturas vencidas</p>
          <p className="metric-value">{overdueInvoices.length}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Cartera pendiente</p>
          <p className="metric-value">{carteraPendiente.length}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Casos baja rentabilidad</p>
          <p className="metric-value">{lowProfitCases.length}</p>
        </article>
      </section>

      <section className="split-grid">
        <article className="card">
          <h2>Facturado vs Cobrado</h2>
          <p>
            Facturado total: <strong>{money(totalFacturado)}</strong>
          </p>
          <p>
            Cobrado total: <strong>{money(totalCobrado)}</strong>
          </p>
          <p>
            Cobro sobre facturado: <strong>{porcentajeCobroSobreFacturado.toFixed(1)}%</strong>
          </p>
        </article>
        <article className="card">
          <h2>Utilidad estimada vs real</h2>
          <p>
            Estimada: <strong>{money(totalUtilidadEstimada)}</strong>
          </p>
          <p>
            Real: <strong>{money(totalUtilidadReal)}</strong>
          </p>
          <p>
            Facturación sobre aprobado: <strong>{porcentajeFacturadoSobreAprobado.toFixed(1)}%</strong>
          </p>
        </article>
      </section>

      <section className="card">
        <h2>Alertas visibles</h2>
        <div className="split-grid">
          <div>
            <h3>Ejecutados sin facturar</h3>
            <ul>
              {executedWithoutInvoice.slice(0, 8).map((row) => (
                <li key={row.id}>
                  <Link href={`/dashboard/casos/${row.id}`}>
                    {row.case_type} -{" "}
                    {(row.requerimientos as { codigo_requerimiento?: string } | null)?.codigo_requerimiento ??
                      (row.technical_projects as { name?: string } | null)?.name ??
                      row.id}
                  </Link>
                </li>
              ))}
              {executedWithoutInvoice.length === 0 ? <li>Sin alertas.</li> : null}
            </ul>
          </div>
          <div>
            <h3>Facturas vencidas</h3>
            <ul>
              {overdueInvoices.slice(0, 8).map((invoice) => (
                <li key={invoice.id}>
                  {invoice.invoice_number} | vence {invoice.due_at} | pendiente {money(Number(invoice.amount_pending))}
                </li>
              ))}
              {overdueInvoices.length === 0 ? <li>Sin alertas.</li> : null}
            </ul>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Ficha financiera por caso/proyecto</h2>
        <div className="activities-list">
          {financialRows.map((row) => (
            <article key={row.id} className="activity-item">
              <p>
                <strong>{row.case_type}</strong> | Caso:{" "}
                {(row.requerimientos as { codigo_requerimiento?: string } | null)?.codigo_requerimiento ??
                  (row.technical_projects as { name?: string } | null)?.name ??
                  "-"}
              </p>
              <p>
                Estado financiero: {row.estado_financiero} | Facturado: {money(Number(row.valor_facturado))} | Cobrado:{" "}
                {money(Number(row.valor_cobrado))}
              </p>
              <p>
                Saldo facturar: {money(Number(row.saldo_por_facturar))} | Saldo cobrar: {money(Number(row.saldo_por_cobrar))} |
                Utilidad real: {money(Number(row.utilidad_real))}
              </p>
              <form action={actualizarFichaFinancieraAction} className="form-grid">
                <input type="hidden" name="return_path" value="/dashboard/finanzas" />
                <input type="hidden" name="id" value={row.id} />
                <input type="number" step="0.01" name="valor_cotizado" defaultValue={Number(row.valor_cotizado)} />
                <input type="number" step="0.01" name="valor_aprobado" defaultValue={Number(row.valor_aprobado)} />
                <select name="requiere_anticipo" defaultValue={row.requiere_anticipo ? "si" : "no"}>
                  <option value="si">requiere anticipo: sí</option>
                  <option value="no">requiere anticipo: no</option>
                </select>
                <input type="number" step="0.01" name="porcentaje_anticipo" defaultValue={Number(row.porcentaje_anticipo ?? 0)} />
                <input type="date" name="fecha_solicitud_anticipo" defaultValue={row.fecha_solicitud_anticipo ?? ""} />
                <input type="date" name="fecha_recepcion_anticipo" defaultValue={row.fecha_recepcion_anticipo ?? ""} />
                <input type="number" step="0.01" name="costo_total_asociado" defaultValue={Number(row.costo_total_asociado)} />
                <select name="estado_financiero" defaultValue={row.estado_financiero}>
                  <option value="sin_cotizacion">sin_cotizacion</option>
                  <option value="cotizado">cotizado</option>
                  <option value="aprobado">aprobado</option>
                  <option value="anticipo_pendiente">anticipo_pendiente</option>
                  <option value="en_ejecucion">en_ejecucion</option>
                  <option value="facturacion_pendiente">facturacion_pendiente</option>
                  <option value="facturado_parcial">facturado_parcial</option>
                  <option value="facturado_total">facturado_total</option>
                  <option value="cartera_pendiente">cartera_pendiente</option>
                  <option value="cerrado">cerrado</option>
                </select>
                <button type="submit">Guardar ficha</button>
              </form>
              <div className="inline-form">
                <Link href={`/dashboard/casos/${row.id}`}>Vista única</Link>
                {row.requerimiento_id ? <Link href={`/dashboard/requerimientos/${row.requerimiento_id}/recursos`}>Ver caso</Link> : null}
                {row.technical_project_id ? (
                  <Link href={`/dashboard/proyectos-tecnicos/${row.technical_project_id}`}>Ver proyecto</Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Registrar anticipo</h2>
        <form action={crearAnticipoAction} className="form-grid">
          <input type="hidden" name="return_path" value="/dashboard/finanzas" />
          <select name="financial_record_id" required>
            <option value="">Caso financiero</option>
            {financialRows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.case_type} -{" "}
                {(row.requerimientos as { codigo_requerimiento?: string } | null)?.codigo_requerimiento ??
                  (row.technical_projects as { name?: string } | null)?.name}
              </option>
            ))}
          </select>
          <input type="date" name="requested_at" />
          <input type="number" step="0.01" name="percentage" placeholder="% anticipo" />
          <input type="number" step="0.01" name="amount_requested" placeholder="Valor solicitado" />
          <input type="number" step="0.01" name="amount_received" placeholder="Valor recibido" />
          <input type="date" name="received_at" />
          <select name="status" defaultValue="solicitado">
            <option value="solicitado">solicitado</option>
            <option value="aprobado">aprobado</option>
            <option value="recibido">recibido</option>
            <option value="rechazado">rechazado</option>
          </select>
          <textarea className="span-2" name="notes" placeholder="Notas" />
          <button type="submit">Registrar anticipo</button>
        </form>
      </section>

      <section className="card">
        <h2>Crear factura</h2>
        <form action={crearFacturaAction} className="form-grid">
          <input type="hidden" name="return_path" value="/dashboard/finanzas" />
          <select name="financial_record_id" required>
            <option value="">Caso financiero</option>
            {financialRows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.case_type} -{" "}
                {(row.requerimientos as { codigo_requerimiento?: string } | null)?.codigo_requerimiento ??
                  (row.technical_projects as { name?: string } | null)?.name}
              </option>
            ))}
          </select>
          <input name="invoice_number" placeholder="Número factura" required />
          <input name="dian_number" placeholder="Número DIAN" />
          <input type="date" name="issued_at" />
          <input type="date" name="due_at" />
          <input type="number" step="0.01" name="amount_subtotal" placeholder="Subtotal" />
          <input type="number" step="0.01" name="amount_tax" placeholder="Impuesto" />
          <input type="number" step="0.01" name="amount_total" placeholder="Total" />
          <input name="pdf_url" placeholder="URL PDF" />
          <input name="xml_url" placeholder="URL XML" />
          <button type="submit">Crear factura</button>
        </form>
      </section>

      <section className="card">
        <h2>Registrar pago y nota crédito</h2>
        <div className="split-grid">
          <form action={registrarPagoFacturaAction} className="form-grid">
            <input type="hidden" name="return_path" value="/dashboard/finanzas" />
            <select name="invoice_id" required>
              <option value="">Factura</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} - pendiente {money(Number(inv.amount_pending))}
                </option>
              ))}
            </select>
            <input type="date" name="paid_at" />
            <input type="number" step="0.01" name="amount" placeholder="Valor pago" required />
            <input name="payment_method" placeholder="Método pago" />
            <input name="reference" placeholder="Referencia" />
            <button type="submit">Registrar pago</button>
          </form>

          <form action={crearNotaCreditoAction} className="form-grid">
            <input type="hidden" name="return_path" value="/dashboard/finanzas" />
            <select name="invoice_id" required>
              <option value="">Factura</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number}
                </option>
              ))}
            </select>
            <input name="note_number" placeholder="Número nota crédito" required />
            <input type="date" name="issued_at" />
            <input type="number" step="0.01" name="amount" placeholder="Valor" required />
            <input name="reason" placeholder="Motivo" required />
            <button type="submit">Registrar nota crédito</button>
          </form>
        </div>
      </section>
    </main>
  );
}
