import Link from "next/link";

import PresupuestoObraDocumento from "@/components/documentos/PresupuestoObraDocumento";
import PrintButton from "@/components/documentos/PrintButton";
import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

interface PresupuestoDocumentoPageProps {
  params: Promise<{ id: string }>;
}

export default async function PresupuestoDocumentoPage({ params }: PresupuestoDocumentoPageProps) {
  await requirePageAccess(
    ["administrador", "asistente"],
    "/dashboard",
    "Acceso denegado al documento de presupuesto."
  );

  const { id } = await params;
  const supabase = createAdminClient();

  const [projectResp, budgetResp] = await Promise.all([
    supabase.from("technical_projects").select("id, name, clients(name)").eq("id", id).maybeSingle(),
    supabase
      .from("project_budget")
      .select("apu_id, capitulo, actividad, cantidad, unidad, precio_unitario, total")
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

  const rows = (budgetResp.data ?? []).map((row) => ({
    capitulo: row.capitulo,
    actividad: row.actividad,
    cantidad: Number(row.cantidad ?? 0),
    unidad: row.unidad,
    precioUnitario: Number(row.precio_unitario ?? 0),
    total: Number(row.total ?? 0),
    origen: row.apu_id ? ("apu" as const) : ("manual" as const)
  }));
  const code = `PRES-${projectResp.data.id.slice(0, 8).toUpperCase()}`;
  const date = new Date().toISOString().slice(0, 10);

  return (
    <main>
      <div className="page-header doc-screen-toolbar">
        <div>
          <h1>Documento presupuesto</h1>
          <p>
            Proyecto: {projectResp.data.name} | Cliente: {(projectResp.data.clients as { name?: string } | null)?.name ?? "-"}
          </p>
        </div>
        <div className="inline-form">
          <PrintButton label="Exportar PDF" />
          <Link href={`/dashboard/proyectos-tecnicos/${id}/presupuesto`}>Volver a presupuesto</Link>
        </div>
      </div>

      <PresupuestoObraDocumento
        codigo={code}
        fecha={date}
        proyecto={projectResp.data.name}
        cliente={(projectResp.data.clients as { name?: string } | null)?.name ?? "-"}
        rows={rows}
      />
    </main>
  );
}
