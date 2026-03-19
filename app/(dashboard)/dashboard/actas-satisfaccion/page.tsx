import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import { crearActaSatisfaccionAction } from "../documentos/actions";

interface ActasSatisfaccionPageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

export default async function ActasSatisfaccionPage({ searchParams }: ActasSatisfaccionPageProps) {
  await requirePageAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede gestionar actas de satisfacción."
  );

  const params = await searchParams;
  const supabase = createAdminClient();

  const [actasResp, reqResp, clientsResp, propertiesResp, workOrdersResp] = await Promise.all([
    supabase
      .from("actas_satisfaccion")
      .select("id, codigo_acta, fecha_acta, satisfaccion, requerimientos(codigo_requerimiento), clients(name)")
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("requerimientos")
      .select("id, codigo_requerimiento, descripcion")
      .order("created_at", { ascending: false })
      .limit(120),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("properties").select("id, name").order("name"),
    supabase.from("work_orders").select("id, codigo_orden").order("created_at", { ascending: false }).limit(120)
  ]);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Actas de satisfacción</h1>
          <p>Documento formal de cierre y conformidad del cliente.</p>
        </div>
        <div className="inline-form">
          <Link href="/dashboard">Volver</Link>
        </div>
      </div>

      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}

      <section className="card">
        <h2>Nueva acta</h2>
        <form action={crearActaSatisfaccionAction} className="form-grid">
          <input name="codigo_acta" placeholder="Código (opcional, autogenerado)" />
          <input type="date" name="fecha_acta" />
          <select name="requerimiento_id" required>
            <option value="">Requerimiento</option>
            {reqResp.data?.map((req) => (
              <option key={req.id} value={req.id}>
                {req.codigo_requerimiento} - {req.descripcion.slice(0, 70)}
              </option>
            ))}
          </select>
          <select name="work_order_id">
            <option value="">Orden de trabajo (opcional)</option>
            {workOrdersResp.data?.map((order) => (
              <option key={order.id} value={order.id}>
                {order.codigo_orden ?? order.id}
              </option>
            ))}
          </select>
          <select name="cliente_id" required>
            <option value="">Cliente</option>
            {clientsResp.data?.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <select name="inmueble_id">
            <option value="">Inmueble</option>
            {propertiesResp.data?.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
          <textarea className="span-2" name="servicio_realizado" placeholder="Servicio realizado" required />
          <textarea className="span-2" name="resultado" placeholder="Resultado del servicio" />
          <select name="satisfaccion" defaultValue="satisfecho">
            <option value="satisfecho">satisfecho</option>
            <option value="parcial">parcial</option>
            <option value="no_satisfecho">no_satisfecho</option>
          </select>
          <input name="firmado_por_nombre" placeholder="Nombre quien firma (cliente)" />
          <input name="firmado_por_documento" placeholder="Documento" />
          <input name="firmado_por_cargo" placeholder="Cargo / relación" />
          <input name="firma_responsable_creixer" placeholder="Firma responsable Creixer (texto)" />
          <textarea className="span-2" name="observaciones" placeholder="Observaciones" />
          <button type="submit">Crear acta</button>
        </form>
      </section>

      <section className="card">
        <h2>Listado</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Requerimiento</th>
                <th>Satisfacción</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {actasResp.data?.map((acta) => (
                <tr key={acta.id}>
                  <td>{acta.codigo_acta}</td>
                  <td>{acta.fecha_acta}</td>
                  <td>{(acta.clients as { name?: string } | null)?.name ?? "-"}</td>
                  <td>{(acta.requerimientos as { codigo_requerimiento?: string } | null)?.codigo_requerimiento ?? "-"}</td>
                  <td>{acta.satisfaccion}</td>
                  <td>
                    <Link href={`/dashboard/actas-satisfaccion/${acta.id}`}>Documento</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
