import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import { crearOrdenTrabajoAction } from "../documentos/actions";

interface OrdenesTrabajoPageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

export default async function OrdenesTrabajoPage({ searchParams }: OrdenesTrabajoPageProps) {
  await requirePageAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede gestionar órdenes de trabajo."
  );

  const params = await searchParams;
  const supabase = createAdminClient();

  const [ordersResp, reqResp, usersResp] = await Promise.all([
    supabase
      .from("work_orders")
      .select(
        "id, codigo_orden, status, fecha_documento, scheduled_start, scheduled_end, requerimientos(codigo_requerimiento, descripcion)"
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("requerimientos")
      .select("id, codigo_requerimiento, descripcion")
      .order("created_at", { ascending: false })
      .limit(120),
    supabase.from("profiles").select("id, full_name").in("role", ["tecnico", "administrador"]).order("full_name")
  ]);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Órdenes de trabajo / reparación</h1>
          <p>Generación documental corporativa para ejecución técnica.</p>
        </div>
        <div className="inline-form">
          <Link href="/dashboard">Volver</Link>
        </div>
      </div>

      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}

      <section className="card">
        <h2>Nueva orden</h2>
        <form action={crearOrdenTrabajoAction} className="form-grid">
          <input name="codigo_orden" placeholder="Código (opcional, autogenerado)" />
          <input type="date" name="fecha_documento" />
          <select name="requerimiento_id" required>
            <option value="">Requerimiento</option>
            {reqResp.data?.map((req) => (
              <option key={req.id} value={req.id}>
                {req.codigo_requerimiento} - {req.descripcion.slice(0, 70)}
              </option>
            ))}
          </select>
          <select name="assigned_technician_id">
            <option value="">Técnico asignado</option>
            {usersResp.data?.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name ?? user.id}
              </option>
            ))}
          </select>
          <select name="status" defaultValue="programada">
            <option value="pendiente">pendiente</option>
            <option value="programada">programada</option>
            <option value="en_progreso">en_progreso</option>
            <option value="pausada">pausada</option>
            <option value="completada">completada</option>
            <option value="cancelada">cancelada</option>
          </select>
          <input type="datetime-local" name="scheduled_start" />
          <input type="datetime-local" name="scheduled_end" />
          <input name="direccion_servicio" placeholder="Dirección servicio" />
          <input name="contacto_nombre" placeholder="Contacto" />
          <input name="contacto_telefono" placeholder="Teléfono contacto" />
          <textarea className="span-2" name="alcance_trabajos" placeholder="Alcance de trabajos" />
          <textarea className="span-2" name="notes" placeholder="Observaciones técnicas" />
          <textarea className="span-2" name="recomendaciones" placeholder="Recomendaciones" />
          <input name="firma_responsable_creixer" placeholder="Firma responsable Creixer (texto)" />
          <button type="submit">Crear orden de trabajo</button>
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
                <th>Estado</th>
                <th>Requerimiento</th>
                <th>Programación</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ordersResp.data?.map((order) => (
                <tr key={order.id}>
                  <td>{order.codigo_orden ?? "-"}</td>
                  <td>{order.fecha_documento ?? "-"}</td>
                  <td>{order.status}</td>
                  <td>{(order.requerimientos as { codigo_requerimiento?: string } | null)?.codigo_requerimiento ?? "-"}</td>
                  <td>{order.scheduled_start ? new Date(order.scheduled_start).toLocaleString("es-CO") : "-"}</td>
                  <td>
                    <Link href={`/dashboard/ordenes-trabajo/${order.id}`}>Documento</Link>
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
