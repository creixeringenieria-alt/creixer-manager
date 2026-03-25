import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  actualizarMaterialAction,
  crearCategoriaInventarioAction,
  crearMaterialAction,
  crearUbicacionAction,
  registrarMovimientoInventarioAction,
  toggleMaterialAction
} from "../actions";

const movementTypes = [
  "entrada_compra",
  "entrada_devolucion",
  "salida_caso",
  "salida_ajuste",
  "salida_perdida",
  "salida_dano",
  "ajuste_manual"
] as const;

interface MaterialesPageProps {
  searchParams: Promise<{ categoria?: string; ubicacion?: string; stock_bajo?: string; ok?: string; error?: string }>;
}

export default async function MaterialesPage({ searchParams }: MaterialesPageProps) {
  await requirePagePermission("ver_inventario", "/dashboard", "Acceso denegado: tu rol no puede acceder a materiales.");

  const params = await searchParams;
  const categoria = params.categoria ?? "";
  const ubicacion = params.ubicacion ?? "";
  const stockBajo = params.stock_bajo === "si";

  const supabase = createAdminClient();

  const [categoriesResp, locationsResp, itemsResp, movementsResp, casesResp, usersResp] = await Promise.all([
    supabase.from("inventory_categories").select("id, name, active").order("name"),
    supabase.from("storage_locations").select("id, name, active").order("name"),
    supabase
      .from("inventory_items")
      .select(
        "id, code, name, unit, stock_current, stock_min, average_unit_cost, qr_code, active, category_id, storage_location_id, inventory_categories(name), storage_locations(name)"
      )
      .order("name"),
    supabase
      .from("inventory_movements")
      .select(
        "id, movement_type, quantity, unit_cost, total_cost, notes, created_at, inventory_items(name), requerimientos(codigo_requerimiento), profiles(full_name)"
      )
      .order("created_at", { ascending: false })
      .limit(120),
    supabase.from("requerimientos").select("id, codigo_requerimiento").order("created_at", { ascending: false }).limit(100),
    supabase.from("profiles").select("id, full_name, role").order("full_name")
  ]);

  let items = itemsResp.data ?? [];
  if (categoria) {
    items = items.filter((item) => item.category_id === categoria);
  }
  if (ubicacion) {
    items = items.filter((item) => item.storage_location_id === ubicacion);
  }
  if (stockBajo) {
    items = items.filter((item) => Number(item.stock_current) <= Number(item.stock_min));
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Materiales consumibles</h1>
          <p>Gestión de stock, movimientos y trazabilidad por caso.</p>
        </div>
        <div className="inline-form">
          <Link href="/dashboard/almacen">Dashboard almacén</Link>
          <Link href="/dashboard/almacen/herramientas">Herramientas</Link>
        </div>
      </div>

      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}

      <section className="card">
        <h2>Filtros</h2>
        <form method="GET" className="inline-form">
          <select name="categoria" defaultValue={categoria}>
            <option value="">Todas las categorías</option>
            {categoriesResp.data?.map((cat) => (
              <option value={cat.id} key={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <select name="ubicacion" defaultValue={ubicacion}>
            <option value="">Todas las ubicaciones</option>
            {locationsResp.data?.map((loc) => (
              <option value={loc.id} key={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <select name="stock_bajo" defaultValue={stockBajo ? "si" : ""}>
            <option value="">Todos los niveles</option>
            <option value="si">Solo stock bajo</option>
          </select>
          <button type="submit">Aplicar</button>
        </form>
      </section>

      <section className="card">
        <h2>Configuración base</h2>
        <div className="split-grid">
          <form action={crearCategoriaInventarioAction} className="inline-form">
            <input type="hidden" name="return_path" value="/dashboard/almacen/materiales" />
            <input name="name" placeholder="Nueva categoría inventario" required />
            <button type="submit">Crear categoría</button>
          </form>
          <form action={crearUbicacionAction} className="inline-form">
            <input type="hidden" name="return_path" value="/dashboard/almacen/materiales" />
            <input name="name" placeholder="Nueva ubicación" required />
            <input name="description" placeholder="Descripción" />
            <button type="submit">Crear ubicación</button>
          </form>
        </div>
      </section>

      <section className="card">
        <h2>Crear material</h2>
        <form action={crearMaterialAction} className="form-grid">
          <input type="hidden" name="return_path" value="/dashboard/almacen/materiales" />
          <input name="code" placeholder="Código" required />
          <input name="name" placeholder="Nombre" required />
          <select name="category_id" required>
            <option value="">Categoría</option>
            {categoriesResp.data?.filter((row) => row.active).map((cat) => (
              <option value={cat.id} key={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <input name="unit" placeholder="Unidad (kg, und, m2...)" required />
          <input type="number" min="0" step="0.01" name="stock_current" placeholder="Stock actual" />
          <input type="number" min="0" step="0.01" name="stock_min" placeholder="Stock mínimo" />
          <input type="number" min="0" step="0.01" name="average_unit_cost" placeholder="Costo unitario promedio" />
          <select name="storage_location_id">
            <option value="">Ubicación</option>
            {locationsResp.data?.filter((row) => row.active).map((loc) => (
              <option value={loc.id} key={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <input name="qr_code" placeholder="Código QR (texto/URL)" />
          <button type="submit">Crear material</button>
        </form>
      </section>

      <section className="card">
        <h2>Registrar movimiento</h2>
        <form action={registrarMovimientoInventarioAction} className="form-grid">
          <input type="hidden" name="return_path" value="/dashboard/almacen/materiales" />
          <select name="item_id" required>
            <option value="">Material</option>
            {(itemsResp.data ?? []).filter((row) => row.active).map((item) => (
              <option value={item.id} key={item.id}>
                {item.code} - {item.name}
              </option>
            ))}
          </select>
          <select name="movement_type" required>
            {movementTypes.map((type) => (
              <option value={type} key={type}>
                {type}
              </option>
            ))}
          </select>
          <input type="number" step="0.01" name="quantity" placeholder="Cantidad (+/- para ajuste_manual)" required />
          <input type="number" min="0" step="0.01" name="unit_cost" placeholder="Costo unitario (opcional)" />
          <select name="case_id">
            <option value="">Caso (opcional)</option>
            {casesResp.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo_requerimiento}
              </option>
            ))}
          </select>
          <select name="performed_by">
            <option value="">Responsable (opcional)</option>
            {usersResp.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name ?? u.id}
              </option>
            ))}
          </select>
          <textarea className="span-2" name="notes" placeholder="Notas del movimiento" />
          <button type="submit">Registrar movimiento</button>
        </form>
      </section>

      <section className="card">
        <h2>Listado de materiales</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Ubicación</th>
                <th>Stock</th>
                <th>Mín.</th>
                <th>Costo prom.</th>
                <th>QR</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const lowStock = Number(item.stock_current) <= Number(item.stock_min);
                return (
                  <tr key={item.id}>
                    <td>{item.code}</td>
                    <td>{item.name}</td>
                    <td>{(item.inventory_categories as { name?: string } | null)?.name ?? "-"}</td>
                    <td>{(item.storage_locations as { name?: string } | null)?.name ?? "-"}</td>
                    <td className={lowStock ? "stock-low" : ""}>{Number(item.stock_current)}</td>
                    <td>{Number(item.stock_min)}</td>
                    <td>{Number(item.average_unit_cost).toLocaleString("es-CO")}</td>
                    <td>{item.qr_code ?? "-"}</td>
                    <td>{item.active ? "Activo" : "Inactivo"}</td>
                    <td>
                      <Link href={`/dashboard/almacen/qr?codigo=${encodeURIComponent(item.qr_code ?? item.code)}`}>Ver QR</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h3 style={{ marginTop: "1rem" }}>Edición rápida</h3>
        <div className="activities-list">
          {items.map((item) => (
            <article key={item.id} className="activity-item">
              <form action={actualizarMaterialAction} className="form-grid">
                <input type="hidden" name="return_path" value="/dashboard/almacen/materiales" />
                <input type="hidden" name="id" value={item.id} />
                <input name="code" defaultValue={item.code} required />
                <input name="name" defaultValue={item.name} required />
                <select name="category_id" defaultValue={item.category_id ?? ""}>
                  {(categoriesResp.data ?? []).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <input name="unit" defaultValue={item.unit} />
                <input type="number" min="0" step="0.01" name="stock_min" defaultValue={Number(item.stock_min)} />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="average_unit_cost"
                  defaultValue={Number(item.average_unit_cost)}
                />
                <select name="storage_location_id" defaultValue={item.storage_location_id ?? ""}>
                  <option value="">Sin ubicación</option>
                  {(locationsResp.data ?? []).map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
                <input name="qr_code" defaultValue={item.qr_code ?? ""} />
                <label className="checkbox-row">
                  <input type="checkbox" name="active" value="si" defaultChecked={item.active} />
                  Activo
                </label>
                <button type="submit">Guardar cambios</button>
              </form>
              <form action={toggleMaterialAction} className="inline-form">
                <input type="hidden" name="return_path" value="/dashboard/almacen/materiales" />
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="active" value={item.active ? "si" : "no"} />
                <button type="submit" className="ghost-btn">
                  {item.active ? "Inactivar" : "Activar"}
                </button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Historial de movimientos</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Material</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Costo total</th>
                <th>Caso</th>
                <th>Responsable</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {movementsResp.data?.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString("es-CO")}</td>
                  <td>{(row.inventory_items as { name?: string } | null)?.name ?? "-"}</td>
                  <td>{row.movement_type}</td>
                  <td>{Number(row.quantity)}</td>
                  <td>{Number(row.total_cost).toLocaleString("es-CO")}</td>
                  <td>{(row.requerimientos as { codigo_requerimiento?: string } | null)?.codigo_requerimiento ?? "-"}</td>
                  <td>{(row.profiles as { full_name?: string } | null)?.full_name ?? "-"}</td>
                  <td>{row.notes ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
