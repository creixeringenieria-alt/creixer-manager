import { redirect } from "next/navigation";

import { requireActionPermission, requirePagePermission } from "@/lib/auth/permissions";

interface NuevoCasoPageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

async function iniciarCasoProyectoAction(formData: FormData) {
  "use server";

  await requireActionPermission("crear_casos", "/dashboard", "Acceso denegado para crear casos/proyectos.");

  const tipo = String(formData.get("tipo_flujo") ?? "");
  if (!tipo) {
    redirect("/dashboard/casos/nuevo?error=Debes seleccionar un tipo de caso/proyecto.");
  }

  if (tipo === "mantenimiento" || tipo === "reparacion") {
    redirect(`/dashboard/requerimientos?ok=${encodeURIComponent(`Flujo ${tipo} iniciado desde Caso/Proyecto.`)}`);
  }

  if (tipo === "consultoria" || tipo === "interventoria") {
    redirect(`/dashboard/proyectos-tecnicos?ok=${encodeURIComponent(`Flujo ${tipo} iniciado desde Caso/Proyecto.`)}`);
  }

  redirect("/dashboard/casos/nuevo?error=Tipo no válido.");
}

export default async function NuevoCasoProyectoPage({ searchParams }: NuevoCasoPageProps) {
  await requirePagePermission("crear_casos", "/dashboard", "Acceso denegado para crear casos/proyectos.");

  const params = await searchParams;

  return (
    <main>
      <h1>Nuevo caso/proyecto</h1>
      <p>Entidad de entrada única para operación. Selecciona tipo y continúa en el flujo especializado.</p>
      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}

      <section className="card">
        <h2>Tipo de caso/proyecto</h2>
        <form action={iniciarCasoProyectoAction} className="form-grid">
          <select name="tipo_flujo" required defaultValue="">
            <option value="" disabled>
              Seleccionar tipo
            </option>
            <option value="mantenimiento">mantenimiento</option>
            <option value="reparacion">reparación</option>
            <option value="consultoria">consultoría</option>
            <option value="interventoria">interventoría</option>
          </select>
          <button type="submit">Continuar</button>
        </form>
      </section>

      <section className="card">
        <h2>Flujos habilitados por tipo</h2>
        <ul>
          <li>
            <strong>mantenimiento/reparación:</strong> requerimiento, agenda, visita, cotización, orden, acta, factura.
          </li>
          <li>
            <strong>consultoría/interventoría:</strong> proyecto técnico, documentos, fases/tareas, Gantt, seguimientos,
            entregables, control financiero, factura.
          </li>
        </ul>
      </section>
    </main>
  );
}
