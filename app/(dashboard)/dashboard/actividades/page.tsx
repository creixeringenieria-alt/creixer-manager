import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import { actualizarActividadAction, crearActividadAction, toggleActividadAction } from "./actions";

const categorias = [
  "impermeabilizacion",
  "electricidad",
  "hidraulica",
  "acabados",
  "mantenimiento_general"
] as const;

interface ActividadesPageProps {
  searchParams: Promise<{ categoria?: string; activa?: string; ok?: string; error?: string }>;
}

export default async function ActividadesPage({ searchParams }: ActividadesPageProps) {
  await requirePageAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede acceder al catálogo de actividades."
  );

  const params = await searchParams;
  const categoria = params.categoria ?? "";
  const activa = params.activa ?? "";

  const supabase = createAdminClient();
  let query = supabase
    .from("actividades_catalogo")
    .select("id, nombre_actividad, descripcion_tecnica, unidad, precio_referencial, categoria, activa")
    .order("nombre_actividad", { ascending: true });

  if (categoria) {
    query = query.eq("categoria", categoria);
  }

  if (activa === "si") {
    query = query.eq("activa", true);
  }

  if (activa === "no") {
    query = query.eq("activa", false);
  }

  const { data, error } = await query;

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Catálogo de actividades</h1>
          <p>Actividades reutilizables para cotizaciones.</p>
        </div>
        <Link href="/dashboard">Volver al dashboard</Link>
      </div>

      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}
      {error ? <p className="feedback error">{error.message}</p> : null}

      <section className="card">
        <h2>Filtros</h2>
        <form method="GET" className="inline-form">
          <select name="categoria" defaultValue={categoria}>
            <option value="">Todas las categorías</option>
            {categorias.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select name="activa" defaultValue={activa}>
            <option value="">Activas e inactivas</option>
            <option value="si">Solo activas</option>
            <option value="no">Solo inactivas</option>
          </select>
          <button type="submit">Aplicar</button>
        </form>
      </section>

      <section className="card">
        <h2>Nueva actividad</h2>
        <form action={crearActividadAction} className="form-grid">
          <input name="nombre_actividad" placeholder="Nombre actividad" required />
          <input name="unidad" placeholder="Unidad" required />
          <select name="categoria" required>
            {categorias.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input type="number" min="0" step="0.01" name="precio_referencial" placeholder="Precio referencial" />
          <textarea name="descripcion_tecnica" placeholder="Descripción técnica" className="span-2" />
          <label className="checkbox-row span-2">
            <input type="checkbox" name="activa" value="si" defaultChecked />
            Activa
          </label>
          <button type="submit">Crear actividad</button>
        </form>
      </section>

      <section className="card">
        <h2>Listado</h2>
        <div className="activities-list">
          {data?.map((actividad) => (
            <article key={actividad.id} className="activity-item">
              <form action={actualizarActividadAction} className="form-grid">
                <input type="hidden" name="id" value={actividad.id} />
                <input type="hidden" name="filtro_categoria" value={categoria} />
                <input type="hidden" name="filtro_activa" value={activa} />

                <input name="nombre_actividad" defaultValue={actividad.nombre_actividad} required />
                <input name="unidad" defaultValue={actividad.unidad} required />

                <select name="categoria" defaultValue={actividad.categoria}>
                  {categorias.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="precio_referencial"
                  defaultValue={Number(actividad.precio_referencial)}
                />

                <textarea
                  name="descripcion_tecnica"
                  defaultValue={actividad.descripcion_tecnica ?? ""}
                  className="span-2"
                />

                <label className="checkbox-row span-2">
                  <input type="checkbox" name="activa" value="si" defaultChecked={actividad.activa} />
                  Activa
                </label>

                <div className="inline-form span-2">
                  <button type="submit">Guardar cambios</button>
                </div>
              </form>

              <form action={toggleActividadAction} className="inline-form" style={{ marginTop: "0.5rem" }}>
                <input type="hidden" name="id" value={actividad.id} />
                <input type="hidden" name="activa" value={actividad.activa ? "si" : "no"} />
                <input type="hidden" name="filtro_categoria" value={categoria} />
                <input type="hidden" name="filtro_activa" value={activa} />
                <button type="submit" className="ghost-btn">
                  {actividad.activa ? "Inactivar" : "Activar"}
                </button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
