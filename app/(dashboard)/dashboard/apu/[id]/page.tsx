import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import { actualizarApuItemAction, crearApuItemAction, eliminarApuItemAction } from "../actions";

interface ApuDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}

function money(value: number) {
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export default async function ApuDetailPage({ params, searchParams }: ApuDetailPageProps) {
  await requirePageAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al detalle APU.");

  const { id } = await params;
  const query = await searchParams;
  const supabase = createAdminClient();

  const [apuResp, itemsResp] = await Promise.all([
    supabase.from("apu_catalog").select("id, nombre, unidad, tipo").eq("id", id).maybeSingle(),
    supabase
      .from("apu_items")
      .select("id, tipo, descripcion, cantidad, unidad, costo_unitario, costo_total")
      .eq("apu_id", id)
      .order("created_at", { ascending: true })
  ]);

  if (!apuResp.data) {
    return (
      <main>
        <p className="feedback error">No se encontró el APU.</p>
        <Link href="/dashboard/apu">Volver</Link>
      </main>
    );
  }

  const items = itemsResp.data ?? [];
  const byType = {
    material: items.filter((item) => item.tipo === "material"),
    mano_obra: items.filter((item) => item.tipo === "mano_obra"),
    equipo: items.filter((item) => item.tipo === "equipo")
  };
  const totalApu = items.reduce((sum, item) => sum + Number(item.costo_total ?? 0), 0);
  const subtotalMaterial = items
    .filter((item) => item.tipo === "material")
    .reduce((sum, item) => sum + Number(item.costo_total ?? 0), 0);
  const subtotalManoObra = items
    .filter((item) => item.tipo === "mano_obra")
    .reduce((sum, item) => sum + Number(item.costo_total ?? 0), 0);
  const subtotalEquipo = items
    .filter((item) => item.tipo === "equipo")
    .reduce((sum, item) => sum + Number(item.costo_total ?? 0), 0);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{apuResp.data.nombre}</h1>
          <p>
            Unidad: {apuResp.data.unidad} | Tipo: {apuResp.data.tipo}
          </p>
        </div>
        <div className="inline-form">
          <Link href="/dashboard/apu">Volver catálogo APU</Link>
        </div>
      </div>

      {query.error ? <p className="feedback error">{query.error}</p> : null}
      {query.ok ? <p className="feedback success">{query.ok}</p> : null}

      <section className="metrics-grid">
        <article className="card metric-card">
          <p className="metric-label">Costo total APU</p>
          <p className="metric-value">{money(totalApu)}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Materiales</p>
          <p className="metric-value">{money(subtotalMaterial)}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Mano de obra</p>
          <p className="metric-value">{money(subtotalManoObra)}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Equipos</p>
          <p className="metric-value">{money(subtotalEquipo)}</p>
        </article>
      </section>

      <section className="card">
        <h2>Agregar ítem al APU</h2>
        <form action={crearApuItemAction} className="form-grid">
          <input type="hidden" name="apu_id" value={id} />
          <input type="hidden" name="return_path" value={`/dashboard/apu/${id}`} />
          <select name="tipo" required defaultValue="material">
            <option value="material">material</option>
            <option value="mano_obra">mano_obra</option>
            <option value="equipo">equipo</option>
          </select>
          <input name="descripcion" placeholder="Descripción" required />
          <input type="number" min="0" step="0.0001" name="cantidad" placeholder="Cantidad" required />
          <input name="unidad" placeholder="Unidad" required />
          <input type="number" min="0" step="0.01" name="costo_unitario" placeholder="Costo unitario" required />
          <button type="submit">Agregar ítem</button>
        </form>
      </section>

      <section className="card">
        <h2>Detalle de ítems</h2>
        {(["material", "mano_obra", "equipo"] as const).map((tipo) => (
          <div key={tipo} style={{ marginBottom: "1rem" }}>
            <h3>{tipo === "material" ? "Materiales" : tipo === "mano_obra" ? "Mano de obra" : "Equipos"}</h3>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Cantidad</th>
                    <th>Unidad</th>
                    <th>Costo unitario</th>
                    <th>Costo total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {byType[tipo].map((item) => (
                    <tr key={item.id}>
                      <td>
                        <input form={`apu-item-${item.id}`} name="descripcion" defaultValue={item.descripcion} />
                      </td>
                      <td>
                        <input
                          form={`apu-item-${item.id}`}
                          type="number"
                          min="0"
                          step="0.0001"
                          name="cantidad"
                          defaultValue={Number(item.cantidad)}
                        />
                      </td>
                      <td>
                        <input form={`apu-item-${item.id}`} name="unidad" defaultValue={item.unidad} />
                      </td>
                      <td>
                        <input
                          form={`apu-item-${item.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          name="costo_unitario"
                          defaultValue={Number(item.costo_unitario)}
                        />
                      </td>
                      <td>{money(Number(item.costo_total ?? 0))}</td>
                      <td>
                        <form id={`apu-item-${item.id}`} action={actualizarApuItemAction} className="inline-form">
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="apu_id" value={id} />
                          <input type="hidden" name="tipo" value={item.tipo} />
                          <input type="hidden" name="return_path" value={`/dashboard/apu/${id}`} />
                        </form>
                        <div className="inline-form">
                          <button form={`apu-item-${item.id}`} type="submit">
                            Guardar
                          </button>
                          <form action={eliminarApuItemAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="apu_id" value={id} />
                            <input type="hidden" name="return_path" value={`/dashboard/apu/${id}`} />
                            <button className="danger-btn" type="submit">
                              Eliminar
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {byType[tipo].length === 0 ? (
                    <tr>
                      <td colSpan={6}>Sin ítems en este tipo.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
