import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

interface CotizacionesPageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

export default async function CotizacionesPage({ searchParams }: CotizacionesPageProps) {
  await requirePageAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado: tu rol no puede acceder al módulo de cotizaciones."
  );

  const params = await searchParams;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("cotizaciones")
    .select(
      "id, codigo_cotizacion, fecha_cotizacion, estado, subtotal, aiu_valor, total_final, clients(name), properties(name), requerimientos(codigo_requerimiento)"
    )
    .order("created_at", { ascending: false })
    .limit(80);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Cotizaciones</h1>
          <p>Documentos técnico-comerciales por requerimiento.</p>
        </div>
        <div className="inline-form">
          <Link href="/dashboard">Volver</Link>
          <Link href="/dashboard/cotizaciones/nueva">Nueva cotización</Link>
        </div>
      </div>

      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}
      {error ? <p className="feedback error">{error.message}</p> : null}

      <section className="card">
        <h2>Listado</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Inmueble</th>
                <th>Req.</th>
                <th>Estado</th>
                <th>Total final</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.map((row) => (
                <tr key={row.id}>
                  <td>{row.codigo_cotizacion}</td>
                  <td>{row.fecha_cotizacion}</td>
                  <td>{(row.clients as { name?: string } | null)?.name ?? "-"}</td>
                  <td>{(row.properties as { name?: string } | null)?.name ?? "-"}</td>
                  <td>{(row.requerimientos as { codigo_requerimiento?: string } | null)?.codigo_requerimiento ?? "-"}</td>
                  <td>{row.estado}</td>
                  <td>{Number(row.total_final ?? 0).toLocaleString("es-CO", { maximumFractionDigits: 2 })}</td>
                  <td>
                    <div className="inline-form">
                      <Link href={`/dashboard/cotizaciones/${row.id}`}>Abrir</Link>
                      <Link href={`/dashboard/documentos/cotizaciones/${row.id}`}>Documento</Link>
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
