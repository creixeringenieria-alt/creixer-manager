import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  actualizarApuCatalogAction,
  cambiarEstadoApuCatalogAction,
  crearApuCatalogAction,
  duplicarApuCatalogAction,
  eliminarApuCatalogAction
} from "./actions";

interface ApuPageProps {
  searchParams: Promise<{ ok?: string; error?: string; tipo?: string; activo?: string }>;
}

function money(value: number) {
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export default async function ApuPage({ searchParams }: ApuPageProps) {
  await requirePageAccess(["administrador", "asistente"], "/dashboard", "Acceso denegado al módulo APU.");

  const params = await searchParams;
  const supabase = createAdminClient();

  let catalogQuery = supabase
    .from("apu_catalog")
    .select("id, nombre, unidad, tipo, activo, created_at")
    .order("created_at", { ascending: false });
  if (params.tipo) {
    catalogQuery = catalogQuery.eq("tipo", params.tipo);
  }
  if (params.activo === "si") {
    catalogQuery = catalogQuery.eq("activo", true);
  }
  if (params.activo === "no") {
    catalogQuery = catalogQuery.eq("activo", false);
  }

  const [catalogResp, itemsResp] = await Promise.all([
    catalogQuery.limit(200),
    supabase.from("apu_items").select("apu_id, costo_total")
  ]);

  const totalsByApu = new Map<string, number>();
  for (const row of itemsResp.data ?? []) {
    totalsByApu.set(row.apu_id, (totalsByApu.get(row.apu_id) ?? 0) + Number(row.costo_total ?? 0));
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>APU / Presupuesto de obra</h1>
          <p>Catálogo de análisis de precios unitarios reutilizable por proyecto.</p>
        </div>
        <div className="inline-form">
          <Link href="/dashboard">Volver</Link>
        </div>
      </div>

      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}

      <section className="card">
        <h2>Crear APU</h2>
        <form action={crearApuCatalogAction} className="form-grid">
          <input type="hidden" name="return_path" value="/dashboard/apu" />
          <input name="nombre" placeholder="Nombre actividad APU" required />
          <input name="unidad" placeholder="Unidad (m2, ml, und, etc.)" required />
          <select name="tipo" defaultValue="general">
            <option value="general">general</option>
            <option value="mantenimiento">mantenimiento</option>
            <option value="consultoria">consultoria</option>
            <option value="interventoria">interventoria</option>
          </select>
          <button type="submit">Crear APU</button>
        </form>
      </section>

      <section className="card">
        <h2>Filtros</h2>
        <form method="GET" className="inline-form">
          <select name="tipo" defaultValue={params.tipo ?? ""}>
            <option value="">Todos los tipos</option>
            <option value="general">general</option>
            <option value="mantenimiento">mantenimiento</option>
            <option value="consultoria">consultoria</option>
            <option value="interventoria">interventoria</option>
          </select>
          <select name="activo" defaultValue={params.activo ?? ""}>
            <option value="">Todos</option>
            <option value="si">Activos</option>
            <option value="no">Inactivos</option>
          </select>
          <button type="submit">Aplicar</button>
        </form>
      </section>

      <section className="card">
        <h2>Catálogo APU</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Unidad</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Costo APU</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {catalogResp.data?.map((apu) => (
                <tr key={apu.id}>
                  <td>
                    <input form={`apu-inline-${apu.id}`} name="nombre" defaultValue={apu.nombre} />
                  </td>
                  <td>
                    <input form={`apu-inline-${apu.id}`} name="unidad" defaultValue={apu.unidad} />
                  </td>
                  <td>
                    <select form={`apu-inline-${apu.id}`} name="tipo" defaultValue={apu.tipo}>
                      <option value="general">general</option>
                      <option value="mantenimiento">mantenimiento</option>
                      <option value="consultoria">consultoria</option>
                      <option value="interventoria">interventoria</option>
                    </select>
                  </td>
                  <td>{apu.activo ? "activo" : "inactivo"}</td>
                  <td>{money(totalsByApu.get(apu.id) ?? 0)}</td>
                  <td>
                    <form id={`apu-inline-${apu.id}`} action={actualizarApuCatalogAction} className="inline-form">
                      <input type="hidden" name="id" value={apu.id} />
                      <input type="hidden" name="return_path" value="/dashboard/apu" />
                      <input type="hidden" name="activo" value={apu.activo ? "si" : "no"} />
                    </form>
                    <div className="inline-form">
                      <Link href={`/dashboard/apu/${apu.id}`}>Abrir APU</Link>
                      <button form={`apu-inline-${apu.id}`} type="submit">
                        Guardar
                      </button>
                      <form action={duplicarApuCatalogAction}>
                        <input type="hidden" name="id" value={apu.id} />
                        <input type="hidden" name="return_path" value="/dashboard/apu" />
                        <button type="submit">Duplicar</button>
                      </form>
                      <form action={cambiarEstadoApuCatalogAction}>
                        <input type="hidden" name="id" value={apu.id} />
                        <input type="hidden" name="return_path" value="/dashboard/apu" />
                        <input type="hidden" name="activo" value={apu.activo ? "no" : "si"} />
                        <button type="submit">{apu.activo ? "Inactivar" : "Activar"}</button>
                      </form>
                      <form action={eliminarApuCatalogAction}>
                        <input type="hidden" name="id" value={apu.id} />
                        <input type="hidden" name="return_path" value="/dashboard/apu" />
                        <button className="danger-btn" type="submit">
                          Eliminar
                        </button>
                      </form>
                    </div>
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
