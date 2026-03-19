import Link from "next/link";
import { Fragment } from "react";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  agregarActividadPresupuestoProyectoAction,
  actualizarActividadPresupuestoProyectoAction,
  eliminarActividadPresupuestoProyectoAction
} from "../../../apu/actions";

interface PresupuestoProyectoPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}

function money(value: number) {
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export default async function PresupuestoProyectoPage({ params, searchParams }: PresupuestoProyectoPageProps) {
  await requirePageAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado al presupuesto del proyecto."
  );

  const { id } = await params;
  const query = await searchParams;
  const supabase = createAdminClient();

  const [projectResp, apuResp, budgetResp] = await Promise.all([
    supabase
      .from("technical_projects")
      .select("id, name, type, status, clients(name)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("apu_catalog").select("id, nombre, unidad, tipo, activo").eq("activo", true).order("nombre"),
    supabase
      .from("project_budget")
      .select("id, apu_id, capitulo, actividad, cantidad, unidad, precio_unitario, total, apu_catalog(nombre)")
      .eq("project_id", id)
      .order("capitulo")
      .order("created_at")
  ]);

  if (!projectResp.data) {
    return (
      <main>
        <p className="feedback error">Proyecto no encontrado.</p>
        <Link href="/dashboard/proyectos-tecnicos">Volver</Link>
      </main>
    );
  }

  const budgetRows = budgetResp.data ?? [];
  const totalProjectBudget = budgetRows.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const chapterTotals = budgetRows.reduce<Record<string, number>>((acc, row) => {
    const key = row.capitulo || "sin_capitulo";
    acc[key] = (acc[key] ?? 0) + Number(row.total ?? 0);
    return acc;
  }, {});
  const rowsByChapter = budgetRows.reduce<Record<string, typeof budgetRows>>((acc, row) => {
    const key = row.capitulo || "sin_capitulo";
    acc[key] = [...(acc[key] ?? []), row];
    return acc;
  }, {});

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Presupuesto de obra</h1>
          <p>
            Proyecto: <strong>{projectResp.data.name}</strong> | Cliente:{" "}
            {(projectResp.data.clients as { name?: string } | null)?.name ?? "-"}
          </p>
        </div>
        <div className="inline-form">
          <Link href={`/dashboard/proyectos-tecnicos/${id}`}>Volver al proyecto</Link>
          <Link href="/dashboard/apu">Catálogo APU</Link>
          <Link href={`/dashboard/proyectos-tecnicos/${id}/presupuesto/documento`}>Documento presupuesto</Link>
        </div>
      </div>

      {query.error ? <p className="feedback error">{query.error}</p> : null}
      {query.ok ? <p className="feedback success">{query.ok}</p> : null}

      <section className="metrics-grid">
        <article className="card metric-card">
          <p className="metric-label">Total presupuesto</p>
          <p className="metric-value">{money(totalProjectBudget)}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Actividades</p>
          <p className="metric-value">{budgetRows.length}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Capítulos</p>
          <p className="metric-value">{Object.keys(chapterTotals).length}</p>
        </article>
      </section>

      <section className="card">
        <h2>Agregar actividad al presupuesto</h2>
        <form action={agregarActividadPresupuestoProyectoAction} className="form-grid">
          <input type="hidden" name="project_id" value={id} />
          <input type="hidden" name="return_path" value={`/dashboard/proyectos-tecnicos/${id}/presupuesto`} />
          <input name="capitulo" placeholder="Capítulo (Ej: Cap. 01 preliminares)" required />
          <input name="actividad" placeholder="Actividad" required />
          <select name="apu_id">
            <option value="">Sin APU (manual)</option>
            {apuResp.data?.map((apu) => (
              <option key={apu.id} value={apu.id}>
                {apu.nombre} ({apu.unidad}) [{apu.tipo}]
              </option>
            ))}
          </select>
          <input type="number" min="0" step="0.0001" name="cantidad" placeholder="Cantidad" required />
          <input name="unidad" placeholder="Unidad" required />
          <input
            type="number"
            min="0"
            step="0.01"
            name="precio_unitario"
            placeholder="Precio unitario manual (si no eliges APU)"
          />
          <button type="submit">Agregar al presupuesto</button>
        </form>
        <p className="feedback">Si seleccionas APU, el precio unitario se calcula automáticamente según sus ítems.</p>
      </section>

      <section className="card">
        <h2>Resumen por capítulos</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Capítulo</th>
                <th>Subtotal capítulo</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(chapterTotals).map(([chapter, total]) => (
                <tr key={chapter}>
                  <td>{chapter}</td>
                  <td>{money(total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Detalle del presupuesto</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Capítulo</th>
                <th>Actividad</th>
                <th>APU</th>
                <th>Cantidad</th>
                <th>Unidad</th>
                <th>Precio unitario</th>
                <th>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {Object.entries(rowsByChapter).map(([chapter, rows]) => (
                <Fragment key={`chapter-group-${chapter}`}>
                  <tr key={`chapter-${chapter}`}>
                    <td colSpan={8}>
                      <strong>{chapter}</strong> | Subtotal: {money(chapterTotals[chapter] ?? 0)}
                    </td>
                  </tr>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input form={`budget-row-${row.id}`} name="capitulo" defaultValue={row.capitulo} />
                      </td>
                      <td>
                        <input form={`budget-row-${row.id}`} name="actividad" defaultValue={row.actividad} />
                      </td>
                      <td>{(row.apu_catalog as { nombre?: string } | null)?.nombre ?? "manual"}</td>
                      <td>
                        <input
                          form={`budget-row-${row.id}`}
                          type="number"
                          min="0"
                          step="0.0001"
                          name="cantidad"
                          defaultValue={Number(row.cantidad)}
                        />
                      </td>
                      <td>
                        <input form={`budget-row-${row.id}`} name="unidad" defaultValue={row.unidad} />
                      </td>
                      <td>
                        <input
                          form={`budget-row-${row.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          name="precio_unitario"
                          defaultValue={Number(row.precio_unitario)}
                        />
                      </td>
                      <td>{money(Number(row.total ?? 0))}</td>
                      <td>
                        <form
                          id={`budget-row-${row.id}`}
                          action={actualizarActividadPresupuestoProyectoAction}
                          className="inline-form"
                        >
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="project_id" value={id} />
                          <input type="hidden" name="apu_id" value={row.apu_id ?? ""} />
                          <input type="hidden" name="return_path" value={`/dashboard/proyectos-tecnicos/${id}/presupuesto`} />
                        </form>
                        <div className="inline-form">
                          <button form={`budget-row-${row.id}`} type="submit">
                            Guardar
                          </button>
                          <form action={eliminarActividadPresupuestoProyectoAction}>
                            <input type="hidden" name="id" value={row.id} />
                            <input type="hidden" name="project_id" value={id} />
                            <input type="hidden" name="return_path" value={`/dashboard/proyectos-tecnicos/${id}/presupuesto`} />
                            <button className="danger-btn" type="submit">
                              Eliminar
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="feedback">Usa “Documento presupuesto” para generar la versión formal e imprimir PDF corporativo.</p>
      </section>
    </main>
  );
}
