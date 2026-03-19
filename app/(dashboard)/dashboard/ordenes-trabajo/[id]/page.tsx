import Link from "next/link";

import OrdenReparacionDocumento from "@/components/documentos/OrdenReparacionDocumento";
import PrintButton from "@/components/documentos/PrintButton";
import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

interface OrdenTrabajoDocumentoPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrdenTrabajoDocumentoPage({ params }: OrdenTrabajoDocumentoPageProps) {
  await requirePageAccess(
    ["administrador", "asistente", "tecnico"],
    "/dashboard",
    "Acceso denegado: tu rol no puede abrir órdenes de trabajo."
  );

  const { id } = await params;
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("work_orders")
    .select(
      "id, codigo_orden, status, assigned_technician_id, fecha_documento, scheduled_start, scheduled_end, direccion_servicio, contacto_nombre, contacto_telefono, alcance_trabajos, notes, recomendaciones, requerimientos(codigo_requerimiento, clients(name), properties(name, address))"
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    return (
      <main>
        <p className="feedback error">No se encontró la orden de trabajo.</p>
        <Link href="/dashboard/ordenes-trabajo">Volver</Link>
      </main>
    );
  }

  const req = data.requerimientos as
    | {
        codigo_requerimiento?: string;
        clients?: { name?: string };
        properties?: { name?: string; address?: string };
      }
    | null;
  const tecnico = data.assigned_technician_id
    ? await supabase.from("profiles").select("full_name").eq("id", data.assigned_technician_id).maybeSingle()
    : { data: null, error: null };

  return (
    <main>
      <div className="page-header doc-screen-toolbar">
        <div>
          <h1>Documento orden de trabajo</h1>
          <p>Formato corporativo para uso operativo y cliente.</p>
        </div>
        <div className="inline-form">
          <PrintButton />
          <Link href="/dashboard/ordenes-trabajo">Volver al listado</Link>
        </div>
      </div>

      <OrdenReparacionDocumento
        codigo={data.codigo_orden ?? "OT-SIN-CODIGO"}
        fecha={String(data.fecha_documento ?? "").slice(0, 10)}
        estado={data.status}
        cliente={req?.clients?.name ?? "-"}
        inmueble={req?.properties?.name ?? "-"}
        direccion={data.direccion_servicio ?? req?.properties?.address ?? "-"}
        contacto={`${data.contacto_nombre ?? ""} ${data.contacto_telefono ?? ""}`.trim()}
        requerimiento={req?.codigo_requerimiento ?? "-"}
        tecnico={tecnico.data?.full_name ?? "-"}
        programacionInicio={data.scheduled_start ? new Date(data.scheduled_start).toLocaleString("es-CO") : "-"}
        programacionFin={data.scheduled_end ? new Date(data.scheduled_end).toLocaleString("es-CO") : "-"}
        alcance={data.alcance_trabajos ?? "-"}
        notas={data.notes ?? "-"}
        recomendaciones={data.recomendaciones ?? "-"}
        logoUrl="/logo-creixer.png"
      />
    </main>
  );
}
