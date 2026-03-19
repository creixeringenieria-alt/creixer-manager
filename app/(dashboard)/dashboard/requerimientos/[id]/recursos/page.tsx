import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  asignarHerramientaAction,
  devolverHerramientaAction,
  registrarMovimientoInventarioAction
} from "../../../almacen/actions";

interface RecursosCasoPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}

export default async function RecursosCasoPage({ params, searchParams }: RecursosCasoPageProps) {
  await requirePageAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede gestionar recursos por caso."
  );

  const { id } = await params;
  const query = await searchParams;
  const supabase = createAdminClient();

  const [caseResp, itemsResp, usersResp, toolsResp, movementsResp, assignmentsResp, financialResp, docsResp] = await Promise.all([
    supabase
      .from("requerimientos")
      .select("id, codigo_requerimiento, descripcion, estado")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("inventory_items").select("id, code, name, stock_current, unit, active").eq("active", true).order("name"),
    supabase.from("profiles").select("id, full_name, role").in("role", ["tecnico", "administrador"]).order("full_name"),
    supabase
      .from("tools")
      .select("id, code, name, operational_status, active")
      .eq("active", true)
      .in("operational_status", ["disponible", "asignada"])
      .order("name"),
    supabase
      .from("inventory_movements")
      .select("id, movement_type, quantity, total_cost, notes, created_at, inventory_items(name), profiles(full_name)")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("tool_assignments")
      .select("id, status, assigned_at, expected_return_at, returned_at, notes, tools(name, code), profiles(full_name)")
      .eq("case_id", id)
      .order("created_at", { ascending: false })
    ,
    supabase
      .from("financial_records")
      .select("id, estado_financiero, valor_aprobado, valor_facturado, valor_cobrado, saldo_por_cobrar")
      .eq("requerimiento_id", id)
      .maybeSingle(),
    supabase
      .from("requerimiento_documents")
      .select("id, document_type, name, original_filename, file_url, created_at")
      .eq("requerimiento_id", id)
      .order("created_at", { ascending: false })
  ]);

  if (!caseResp.data) {
    return (
      <main>
        <p className="feedback error">No se encontró el requerimiento.</p>
        <Link href="/dashboard/requerimientos">Volver</Link>
      </main>
    );
  }

  const asignacionesPendientes = (assignmentsResp.data ?? []).filter(
    (row) => row.status === "asignada" || row.status === "vencida"
  );

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Recursos por caso</h1>
          <p>
            Caso: <strong>{caseResp.data.codigo_requerimiento}</strong> | Estado: {caseResp.data.estado}
          </p>
        </div>
        <div className="inline-form">
          <Link href="/dashboard/requerimientos">Volver a requerimientos</Link>
          <Link href="/dashboard/almacen">Ir a almacén</Link>
        </div>
      </div>

      {query.error ? <p className="feedback error">{query.error}</p> : null}
      {query.ok ? <p className="feedback success">{query.ok}</p> : null}

      {caseResp.data.estado === "finalizado" && asignacionesPendientes.length > 0 ? (
        <p className="feedback error">Advertencia: el caso está finalizado pero hay herramientas pendientes por devolver.</p>
      ) : null}

      <section className="card">
        <h2>Estado financiero del caso</h2>
        {financialResp.data ? (
          <p>
            Estado: {financialResp.data.estado_financiero} | Aprobado: {Number(financialResp.data.valor_aprobado).toLocaleString("es-CO")} |
            Facturado: {Number(financialResp.data.valor_facturado).toLocaleString("es-CO")} | Cobrado:{" "}
            {Number(financialResp.data.valor_cobrado).toLocaleString("es-CO")} | Saldo por cobrar:{" "}
            {Number(financialResp.data.saldo_por_cobrar).toLocaleString("es-CO")} | <Link href="/dashboard/finanzas">Abrir finanzas</Link> |{" "}
            <Link href={`/dashboard/casos/${financialResp.data.id}`}>Vista única</Link>
          </p>
        ) : (
          <p className="feedback error">No se encontró expediente financiero para este caso.</p>
        )}
      </section>

      <section className="card">
        <h2>Documentos del caso</h2>
        {docsResp.data?.length ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Nombre</th>
                  <th>Archivo</th>
                </tr>
              </thead>
              <tbody>
                {docsResp.data.map((doc) => (
                  <tr key={doc.id}>
                    <td>{new Date(doc.created_at).toLocaleString("es-CO")}</td>
                    <td>{doc.document_type}</td>
                    <td>{doc.name}</td>
                    <td>{doc.file_url ? <a href={doc.file_url}>{doc.original_filename}</a> : doc.original_filename}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No hay documentos cargados en este caso.</p>
        )}
      </section>

      <section className="card">
        <h2>Registrar salida de material al caso</h2>
        <form action={registrarMovimientoInventarioAction} className="form-grid">
          <input type="hidden" name="return_path" value={`/dashboard/requerimientos/${id}/recursos`} />
          <input type="hidden" name="movement_type" value="salida_caso" />
          <input type="hidden" name="case_id" value={id} />
          <select name="item_id" required>
            <option value="">Material</option>
            {itemsResp.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} - {item.name} ({Number(item.stock_current)} {item.unit})
              </option>
            ))}
          </select>
          <input type="number" min="0.01" step="0.01" name="quantity" placeholder="Cantidad" required />
          <input type="number" min="0" step="0.01" name="unit_cost" placeholder="Costo unitario (opcional)" />
          <select name="performed_by">
            <option value="">Responsable</option>
            {usersResp.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name ?? u.id}
              </option>
            ))}
          </select>
          <textarea className="span-2" name="notes" placeholder="Notas de consumo" />
          <button type="submit">Registrar consumo</button>
        </form>
      </section>

      <section className="card">
        <h2>Asignar herramienta al caso</h2>
        <form action={asignarHerramientaAction} className="form-grid">
          <input type="hidden" name="return_path" value={`/dashboard/requerimientos/${id}/recursos`} />
          <input type="hidden" name="case_id" value={id} />
          <select name="tool_id" required>
            <option value="">Herramienta</option>
            {toolsResp.data?.map((tool) => (
              <option key={tool.id} value={tool.id}>
                {tool.code} - {tool.name} ({tool.operational_status})
              </option>
            ))}
          </select>
          <select name="assigned_to_user_id">
            <option value="">Asignar a</option>
            {usersResp.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name ?? u.id}
              </option>
            ))}
          </select>
          <input type="datetime-local" name="expected_return_at" />
          <input name="delivery_condition" placeholder="Condición de entrega" />
          <textarea className="span-2" name="notes" placeholder="Notas de asignación" />
          <button type="submit">Asignar herramienta</button>
        </form>
      </section>

      <section className="card">
        <h2>Materiales usados en el caso</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Material</th>
                <th>Cantidad</th>
                <th>Costo</th>
                <th>Responsable</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {movementsResp.data?.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString("es-CO")}</td>
                  <td>{row.movement_type}</td>
                  <td>{(row.inventory_items as { name?: string } | null)?.name ?? "-"}</td>
                  <td>{Number(row.quantity)}</td>
                  <td>{Number(row.total_cost).toLocaleString("es-CO")}</td>
                  <td>{(row.profiles as { full_name?: string } | null)?.full_name ?? "-"}</td>
                  <td>{row.notes ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Herramientas asignadas al caso</h2>
        <div className="activities-list">
          {assignmentsResp.data?.map((assignment) => (
            <article className="activity-item" key={assignment.id}>
              <p>
                <strong>{(assignment.tools as { code?: string; name?: string } | null)?.code}</strong> -{" "}
                {(assignment.tools as { code?: string; name?: string } | null)?.name}
              </p>
              <p>
                Responsable: {(assignment.profiles as { full_name?: string } | null)?.full_name ?? "-"} | Estado:{" "}
                {assignment.status}
              </p>
              <p>
                Entrega: {new Date(assignment.assigned_at).toLocaleString("es-CO")} | Devolución esperada:{" "}
                {assignment.expected_return_at ? new Date(assignment.expected_return_at).toLocaleString("es-CO") : "-"}
              </p>
              <p>Notas: {assignment.notes ?? "-"}</p>

              {assignment.status === "asignada" || assignment.status === "vencida" ? (
                <form action={devolverHerramientaAction} className="inline-form">
                  <input type="hidden" name="return_path" value={`/dashboard/requerimientos/${id}/recursos`} />
                  <input type="hidden" name="assignment_id" value={assignment.id} />
                  <select name="status" defaultValue="devuelta">
                    <option value="devuelta">devuelta</option>
                    <option value="danada">danada</option>
                    <option value="vencida">vencida</option>
                  </select>
                  <input name="return_condition" placeholder="Condición de retorno" />
                  <button type="submit">Registrar devolución</button>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
