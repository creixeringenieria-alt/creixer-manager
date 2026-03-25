import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  actualizarHerramientaAction,
  asignarHerramientaAction,
  crearCategoriaHerramientaAction,
  crearHerramientaAction,
  crearUbicacionAction,
  devolverHerramientaAction,
  registrarMantenimientoHerramientaAction,
  toggleHerramientaAction
} from "../actions";

const conditionStatuses = ["excelente", "buena", "regular", "mala"] as const;
const operationalStatuses = ["disponible", "asignada", "mantenimiento", "danada", "perdida", "fuera_servicio"] as const;

interface HerramientasPageProps {
  searchParams: Promise<{ estado?: string; categoria?: string; ok?: string; error?: string }>;
}

export default async function HerramientasPage({ searchParams }: HerramientasPageProps) {
  await requirePagePermission("ver_inventario", "/dashboard", "Acceso denegado: tu rol no puede acceder a herramientas.");

  const params = await searchParams;
  const estado = params.estado ?? "";
  const categoria = params.categoria ?? "";

  const supabase = createAdminClient();
  const [categoriesResp, locationsResp, toolsResp, usersResp, casesResp, assignmentsResp, maintenanceResp] = await Promise.all([
    supabase.from("tool_categories").select("id, name, active").order("name"),
    supabase.from("storage_locations").select("id, name, active").order("name"),
    supabase
      .from("tools")
      .select(
        "id, code, name, serial_number, category_id, purchase_date, purchase_cost, condition_status, operational_status, storage_location_id, current_responsible_id, qr_code, active, tool_categories(name), storage_locations(name), profiles(full_name)"
      )
      .order("name"),
    supabase.from("profiles").select("id, full_name, role").in("role", ["tecnico", "administrador"]).order("full_name"),
    supabase.from("requerimientos").select("id, codigo_requerimiento").order("created_at", { ascending: false }).limit(100),
    supabase
      .from("tool_assignments")
      .select("id, status, assigned_at, expected_return_at, tool_id, tools(name, code), profiles(full_name), requerimientos(codigo_requerimiento)")
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("tool_maintenance_logs")
      .select("id, maintenance_type, description, maintenance_date, cost, tools(name, code)")
      .order("maintenance_date", { ascending: false })
      .limit(80)
  ]);

  let tools = toolsResp.data ?? [];
  if (estado) {
    tools = tools.filter((tool) => tool.operational_status === estado);
  }
  if (categoria) {
    tools = tools.filter((tool) => tool.category_id === categoria);
  }

  const asignacionesActivas = (assignmentsResp.data ?? []).filter((row) => row.status === "asignada" || row.status === "vencida");

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Herramientas y equipos</h1>
          <p>Control de estado, asignaciones, préstamos y mantenimiento.</p>
        </div>
        <div className="inline-form">
          <Link href="/dashboard/almacen">Dashboard almacén</Link>
          <Link href="/dashboard/almacen/materiales">Materiales</Link>
        </div>
      </div>

      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}

      <section className="card">
        <h2>Filtros</h2>
        <form method="GET" className="inline-form">
          <select name="estado" defaultValue={estado}>
            <option value="">Todos los estados</option>
            {operationalStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select name="categoria" defaultValue={categoria}>
            <option value="">Todas las categorías</option>
            {categoriesResp.data?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <button type="submit">Aplicar</button>
        </form>
      </section>

      <section className="card">
        <h2>Configuración base</h2>
        <div className="split-grid">
          <form action={crearCategoriaHerramientaAction} className="inline-form">
            <input type="hidden" name="return_path" value="/dashboard/almacen/herramientas" />
            <input name="name" placeholder="Nueva categoría de herramienta" required />
            <button type="submit">Crear categoría</button>
          </form>
          <form action={crearUbicacionAction} className="inline-form">
            <input type="hidden" name="return_path" value="/dashboard/almacen/herramientas" />
            <input name="name" placeholder="Nueva ubicación" required />
            <input name="description" placeholder="Descripción" />
            <button type="submit">Crear ubicación</button>
          </form>
        </div>
      </section>

      <section className="card">
        <h2>Crear herramienta</h2>
        <form action={crearHerramientaAction} className="form-grid">
          <input type="hidden" name="return_path" value="/dashboard/almacen/herramientas" />
          <input name="code" placeholder="Código" required />
          <input name="name" placeholder="Nombre" required />
          <input name="serial_number" placeholder="Serial (opcional)" />
          <select name="category_id" required>
            <option value="">Categoría</option>
            {categoriesResp.data?.filter((row) => row.active).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <input type="date" name="purchase_date" />
          <input type="number" min="0" step="0.01" name="purchase_cost" placeholder="Costo compra" />
          <select name="condition_status" defaultValue="buena">
            {conditionStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select name="operational_status" defaultValue="disponible">
            {operationalStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select name="storage_location_id">
            <option value="">Ubicación</option>
            {locationsResp.data?.filter((row) => row.active).map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <input name="qr_code" placeholder="Código QR (texto/URL)" />
          <button type="submit">Crear herramienta</button>
        </form>
      </section>

      <section className="card">
        <h2>Asignar herramienta</h2>
        <form action={asignarHerramientaAction} className="form-grid">
          <input type="hidden" name="return_path" value="/dashboard/almacen/herramientas" />
          <select name="tool_id" required>
            <option value="">Herramienta</option>
            {(toolsResp.data ?? []).filter((row) => row.active).map((tool) => (
              <option key={tool.id} value={tool.id}>
                {tool.code} - {tool.name}
              </option>
            ))}
          </select>
          <select name="assigned_to_user_id">
            <option value="">Asignar a técnico/responsable</option>
            {usersResp.data?.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name ?? user.id}
              </option>
            ))}
          </select>
          <select name="case_id">
            <option value="">Caso (opcional)</option>
            {casesResp.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo_requerimiento}
              </option>
            ))}
          </select>
          <input type="datetime-local" name="expected_return_at" />
          <input name="delivery_condition" placeholder="Condición de entrega" />
          <textarea className="span-2" name="notes" placeholder="Observaciones" />
          <button type="submit">Asignar</button>
        </form>
      </section>

      <section className="card">
        <h2>Herramientas registradas</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Estado operativo</th>
                <th>Condición</th>
                <th>Ubicación</th>
                <th>Responsable</th>
                <th>QR</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => (
                <tr key={tool.id}>
                  <td>{tool.code}</td>
                  <td>{tool.name}</td>
                  <td>{(tool.tool_categories as { name?: string } | null)?.name ?? "-"}</td>
                  <td>{tool.operational_status}</td>
                  <td>{tool.condition_status}</td>
                  <td>{(tool.storage_locations as { name?: string } | null)?.name ?? "-"}</td>
                  <td>{(tool.profiles as { full_name?: string } | null)?.full_name ?? "-"}</td>
                  <td>{tool.qr_code ?? "-"}</td>
                  <td>
                    <Link href={`/dashboard/almacen/qr?codigo=${encodeURIComponent(tool.qr_code ?? tool.code)}`}>Ver QR</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Edición rápida</h2>
        <div className="activities-list">
          {tools.map((tool) => (
            <article className="activity-item" key={tool.id}>
              <form action={actualizarHerramientaAction} className="form-grid">
                <input type="hidden" name="return_path" value="/dashboard/almacen/herramientas" />
                <input type="hidden" name="id" value={tool.id} />
                <input name="code" defaultValue={tool.code} required />
                <input name="name" defaultValue={tool.name} required />
                <input name="serial_number" defaultValue={tool.serial_number ?? ""} />
                <select name="category_id" defaultValue={tool.category_id ?? ""}>
                  {(categoriesResp.data ?? []).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <input type="date" name="purchase_date" defaultValue={tool.purchase_date ?? ""} />
                <input type="number" min="0" step="0.01" name="purchase_cost" defaultValue={Number(tool.purchase_cost ?? 0)} />
                <select name="condition_status" defaultValue={tool.condition_status}>
                  {conditionStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <select name="operational_status" defaultValue={tool.operational_status}>
                  {operationalStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <select name="storage_location_id" defaultValue={tool.storage_location_id ?? ""}>
                  <option value="">Sin ubicación</option>
                  {(locationsResp.data ?? []).map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
                <input name="qr_code" defaultValue={tool.qr_code ?? ""} />
                <label className="checkbox-row">
                  <input type="checkbox" name="active" value="si" defaultChecked={tool.active} />
                  Activa
                </label>
                <button type="submit">Guardar cambios</button>
              </form>

              <form action={toggleHerramientaAction} className="inline-form">
                <input type="hidden" name="return_path" value="/dashboard/almacen/herramientas" />
                <input type="hidden" name="id" value={tool.id} />
                <input type="hidden" name="active" value={tool.active ? "si" : "no"} />
                <button type="submit" className="ghost-btn">
                  {tool.active ? "Inactivar" : "Activar"}
                </button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Devolución de herramientas</h2>
        {asignacionesActivas.length === 0 ? (
          <p>No hay asignaciones activas.</p>
        ) : (
          <div className="activities-list">
            {asignacionesActivas.map((row) => (
              <article className="activity-item" key={row.id}>
                <p>
                  <strong>{(row.tools as { code?: string; name?: string } | null)?.code}</strong> -{" "}
                  {(row.tools as { code?: string; name?: string } | null)?.name}
                </p>
                <p>
                  Responsable: {(row.profiles as { full_name?: string } | null)?.full_name ?? "-"} | Caso:{" "}
                  {(row.requerimientos as { codigo_requerimiento?: string } | null)?.codigo_requerimiento ?? "-"}
                </p>
                <form action={devolverHerramientaAction} className="inline-form">
                  <input type="hidden" name="return_path" value="/dashboard/almacen/herramientas" />
                  <input type="hidden" name="assignment_id" value={row.id} />
                  <select name="status" defaultValue="devuelta">
                    <option value="devuelta">devuelta</option>
                    <option value="danada">danada</option>
                    <option value="vencida">vencida</option>
                  </select>
                  <input name="return_condition" placeholder="Condición de retorno" />
                  <button type="submit">Registrar devolución</button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Mantenimiento</h2>
        <form action={registrarMantenimientoHerramientaAction} className="form-grid">
          <input type="hidden" name="return_path" value="/dashboard/almacen/herramientas" />
          <select name="tool_id" required>
            <option value="">Herramienta</option>
            {(toolsResp.data ?? []).map((tool) => (
              <option key={tool.id} value={tool.id}>
                {tool.code} - {tool.name}
              </option>
            ))}
          </select>
          <input name="maintenance_type" placeholder="Tipo de mantenimiento" required />
          <input type="date" name="maintenance_date" />
          <input type="number" min="0" step="0.01" name="cost" placeholder="Costo" />
          <input type="date" name="next_maintenance_date" />
          <textarea className="span-2" name="description" placeholder="Descripción" required />
          <button type="submit">Registrar mantenimiento</button>
        </form>

        <h3 style={{ marginTop: "1rem" }}>Historial de mantenimiento</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Herramienta</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Costo</th>
              </tr>
            </thead>
            <tbody>
              {maintenanceResp.data?.map((log) => (
                <tr key={log.id}>
                  <td>{log.maintenance_date}</td>
                  <td>
                    {(log.tools as { code?: string; name?: string } | null)?.code} -{" "}
                    {(log.tools as { code?: string; name?: string } | null)?.name}
                  </td>
                  <td>{log.maintenance_type}</td>
                  <td>{log.description}</td>
                  <td>{Number(log.cost ?? 0).toLocaleString("es-CO")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
