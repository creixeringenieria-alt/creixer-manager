import CorporateDocumentLayout from "@/components/documentos/CorporateDocumentLayout";

interface OrdenReparacionDocumentoProps {
  codigo: string;
  fecha: string;
  estado: string;
  cliente: string;
  inmueble: string;
  direccion: string;
  contacto: string;
  requerimiento: string;
  tecnico: string;
  programacionInicio: string;
  programacionFin: string;
  alcance: string;
  notas: string;
  recomendaciones: string;
  logoUrl?: string;
  watermarkUrl?: string;
}

export default function OrdenReparacionDocumento({
  codigo,
  fecha,
  estado,
  cliente,
  inmueble,
  direccion,
  contacto,
  requerimiento,
  tecnico,
  programacionInicio,
  programacionFin,
  alcance,
  notas,
  recomendaciones,
  logoUrl,
  watermarkUrl
}: OrdenReparacionDocumentoProps) {
  return (
    <CorporateDocumentLayout
      title="Orden de reparación / trabajo"
      code={codigo}
      date={fecha}
      logoUrl={logoUrl}
      watermarkUrl={watermarkUrl}
      watermarkText="ORDEN DE TRABAJO"
      signatureName="Responsable Operativo"
      signatureRole="Creixer Ingeniería"
    >
      <section className="doc-section">
        <h3>Datos de servicio</h3>
        <p>
          <strong>Estado:</strong> {estado}
        </p>
        <p>
          <strong>ID servicio:</strong> {requerimiento}
        </p>
        <p>
          <strong>Cliente:</strong> {cliente}
        </p>
        <p>
          <strong>Inmueble:</strong> {inmueble}
        </p>
        <p>
          <strong>Dirección:</strong> {direccion || "-"}
        </p>
        <p>
          <strong>Contacto:</strong> {contacto || "-"}
        </p>
      </section>

      <section className="doc-section">
        <h3>Programación operativa</h3>
        <p>
          <strong>Técnico asignado:</strong> {tecnico || "-"}
        </p>
        <p>
          <strong>Inicio programado:</strong> {programacionInicio || "-"}
        </p>
        <p>
          <strong>Fin programado:</strong> {programacionFin || "-"}
        </p>
      </section>

      <section className="doc-section">
        <h3>Alcance de reparación</h3>
        <p>{alcance || "-"}</p>
      </section>

      <section className="doc-section">
        <h3>Observaciones técnicas</h3>
        <p>{notas || "-"}</p>
      </section>

      <section className="doc-section">
        <h3>Recomendaciones</h3>
        <p>{recomendaciones || "-"}</p>
      </section>
    </CorporateDocumentLayout>
  );
}
