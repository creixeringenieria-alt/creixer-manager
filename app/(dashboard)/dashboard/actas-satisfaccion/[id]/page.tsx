import Link from "next/link";

import ActaSatisfaccionDocumento from "@/components/documentos/ActaSatisfaccionDocumento";
import PrintButton from "@/components/documentos/PrintButton";
import { requirePageAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

interface ActaSatisfaccionDocumentoPageProps {
  params: Promise<{ id: string }>;
}

export default async function ActaSatisfaccionDocumentoPage({ params }: ActaSatisfaccionDocumentoPageProps) {
  await requirePageAccess(
    ["administrador", "asistente", "tecnico"],
    "/dashboard",
    "Acceso denegado: tu rol no puede abrir actas de satisfacción."
  );

  const { id } = await params;
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("actas_satisfaccion")
    .select(
      "id, codigo_acta, fecha_acta, servicio_realizado, resultado, satisfaccion, observaciones, firmado_por_nombre, firmado_por_documento, firmado_por_cargo, firma_responsable_creixer, requerimientos(codigo_requerimiento, properties(name, address)), clients(name)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    return (
      <main>
        <p className="feedback error">No se encontró el acta de satisfacción.</p>
        <Link href="/dashboard/actas-satisfaccion">Volver</Link>
      </main>
    );
  }

  const req = data.requerimientos as
    | {
        codigo_requerimiento?: string;
        properties?: { name?: string; address?: string };
      }
    | null;

  return (
    <main>
      <div className="page-header doc-screen-toolbar">
        <div>
          <h1>Documento acta de satisfacción</h1>
          <p>Formato formal para cierre y aceptación del cliente.</p>
        </div>
        <div className="inline-form">
          <PrintButton />
          <Link href="/dashboard/actas-satisfaccion">Volver al listado</Link>
        </div>
      </div>

      <ActaSatisfaccionDocumento
        codigo={data.codigo_acta}
        fecha={String(data.fecha_acta)}
        cliente={(data.clients as { name?: string } | null)?.name ?? "-"}
        inmueble={req?.properties?.name ?? "-"}
        direccion={req?.properties?.address ?? "-"}
        requerimiento={req?.codigo_requerimiento ?? "-"}
        servicioRealizado={data.servicio_realizado}
        resultado={data.resultado ?? "-"}
        satisfaccion={data.satisfaccion}
        observaciones={data.observaciones ?? "-"}
        firmadoPorNombre={data.firmado_por_nombre ?? "-"}
        firmadoPorDocumento={data.firmado_por_documento ?? "-"}
        firmadoPorCargo={data.firmado_por_cargo ?? "-"}
        firmaResponsableCreixer={data.firma_responsable_creixer ?? "Responsable Creixer"}
        logoUrl="/logo-creixer.png"
      />
    </main>
  );
}
