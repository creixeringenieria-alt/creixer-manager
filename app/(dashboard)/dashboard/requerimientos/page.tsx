import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { ESTADOS_REQUERIMIENTO, PRIORIDADES_REQUERIMIENTO, TIPOS_SERVICIO } from "@/lib/operaciones/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { crearRequerimientoAction } from "./actions";

interface RequerimientosPageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

export default async function RequerimientosPage({ searchParams }: RequerimientosPageProps) {
  await requirePageAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede acceder al módulo de requerimientos."
  );

  const params = await searchParams;
  const supabase = createAdminClient();

  const [clientesResp, inmueblesResp, requerimientosResp] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("properties").select("id, name, address, client_id, clients(name)").order("name"),
    supabase
      .from("requerimientos")
      .select(
        "id, codigo_requerimiento, descripcion, canal_ingreso, tipo_servicio, prioridad, estado, fecha_reporte, clients(name), properties(name)"
      )
      .order("created_at", { ascending: false })
      .limit(50)
  ]);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Requerimientos</h1>
          <p>Registro inicial de casos reportados por inmobiliaria.</p>
        </div>
        <Link href="/dashboard">Volver al dashboard</Link>
      </div>

      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}

      <section className="card">
        <h2>Nuevo requerimiento</h2>
        <form action={crearRequerimientoAction} className="form-grid">
          <input name="codigo_requerimiento" placeholder="Código (opcional, auto si vacío)" />

          <select name="cliente_id" required>
            <option value="">Cliente</option>
            {clientesResp.data?.map((cliente) => (
              <option value={cliente.id} key={cliente.id}>
                {cliente.name}
              </option>
            ))}
          </select>

          <select name="inmueble_id" required>
            <option value="">Inmueble</option>
            {inmueblesResp.data?.map((inmueble) => (
              <option value={inmueble.id} key={inmueble.id}>
                {inmueble.name} - {inmueble.address ?? "Sin dirección"}
              </option>
            ))}
          </select>

          <input name="contacto_nombre" placeholder="Contacto nombre" />
          <input name="contacto_telefono" placeholder="Contacto teléfono" />
          <input name="canal_ingreso" defaultValue="WhatsApp" placeholder="Canal de ingreso" />

          <select name="tipo_servicio" required>
            {TIPOS_SERVICIO.map((tipo) => (
              <option value={tipo} key={tipo}>
                {tipo}
              </option>
            ))}
          </select>

          <select name="prioridad" defaultValue="media">
            {PRIORIDADES_REQUERIMIENTO.map((prioridad) => (
              <option value={prioridad} key={prioridad}>
                {prioridad}
              </option>
            ))}
          </select>

          <select name="estado" defaultValue="pendiente">
            {ESTADOS_REQUERIMIENTO.map((estado) => (
              <option value={estado} key={estado}>
                {estado}
              </option>
            ))}
          </select>

          <input type="date" name="fecha_reporte" />
          <textarea name="descripcion" placeholder="Descripción" required />
          <textarea name="observaciones_internas" placeholder="Observaciones internas" />
          <select name="document_type" defaultValue="archivo_tecnico">
            <option value="convocatoria">convocatoria</option>
            <option value="terminos_referencia">terminos_referencia</option>
            <option value="anexos">anexos</option>
            <option value="planos">planos</option>
            <option value="documento_cliente">documento_cliente</option>
            <option value="archivo_tecnico">archivo_tecnico</option>
            <option value="otro">otro</option>
          </select>
          <input name="document_name" placeholder="Nombre de documento (opcional)" />
          <label className="file-input-label span-2">
            Adjuntar documentos del caso
            <input type="file" name="documentos" multiple />
          </label>

          <button type="submit">Crear requerimiento</button>
        </form>
      </section>

      <section className="card">
        <h2>Listado de requerimientos</h2>
        {requerimientosResp.error ? (
          <p className="feedback error">{requerimientosResp.error.message}</p>
        ) : null}

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Inmueble</th>
                <th>Servicio</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {requerimientosResp.data?.map((row) => (
                <tr key={row.id}>
                  <td>{row.codigo_requerimiento}</td>
                  <td>{(row.clients as { name?: string } | null)?.name ?? "-"}</td>
                  <td>{(row.properties as { name?: string } | null)?.name ?? "-"}</td>
                  <td>{row.tipo_servicio}</td>
                  <td>{row.prioridad}</td>
                  <td>{row.estado}</td>
                  <td>{row.fecha_reporte}</td>
                  <td>
                    <Link href={`/dashboard/requerimientos/${row.id}/recursos`}>Recursos</Link>
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
