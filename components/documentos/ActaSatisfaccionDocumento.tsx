import CorporateDocumentLayout from "@/components/documentos/CorporateDocumentLayout";

interface ActaSatisfaccionDocumentoProps {
  codigo: string;
  fecha: string;
  cliente: string;
  inmueble: string;
  direccion: string;
  requerimiento: string;
  servicioRealizado: string;
  resultado: string;
  satisfaccion: string;
  observaciones: string;
  firmadoPorNombre: string;
  firmadoPorDocumento: string;
  firmadoPorCargo: string;
  firmaResponsableCreixer: string;
  logoUrl?: string;
  watermarkUrl?: string;
}

export default function ActaSatisfaccionDocumento({
  codigo,
  fecha,
  cliente,
  inmueble,
  direccion,
  requerimiento,
  servicioRealizado,
  resultado,
  satisfaccion,
  observaciones,
  firmadoPorNombre,
  firmadoPorDocumento,
  firmadoPorCargo,
  firmaResponsableCreixer,
  logoUrl,
  watermarkUrl
}: ActaSatisfaccionDocumentoProps) {
  return (
    <CorporateDocumentLayout
      title="Acta de satisfacción"
      code={codigo}
      date={fecha}
      logoUrl={logoUrl}
      watermarkUrl={watermarkUrl}
      watermarkText="ACTA DE SATISFACCION"
      signatureName={firmaResponsableCreixer || "Responsable Creixer"}
      signatureRole="Creixer Ingeniería"
    >
      <section className="doc-section">
        <h3>Datos del servicio</h3>
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
          <strong>ID servicio:</strong> {requerimiento}
        </p>
      </section>

      <section className="doc-section">
        <h3>Certificación de servicio</h3>
        <p>
          <strong>Servicio realizado:</strong> {servicioRealizado}
        </p>
        <p>
          <strong>Resultado:</strong> {resultado || "-"}
        </p>
        <p>
          <strong>Nivel de satisfacción:</strong> {satisfaccion}
        </p>
        <p>
          <strong>Observaciones:</strong> {observaciones || "-"}
        </p>
      </section>

      <section className="doc-section">
        <h3>Firma de aceptación del cliente</h3>
        <p>
          <strong>Nombre:</strong> {firmadoPorNombre || "-"}
        </p>
        <p>
          <strong>Documento:</strong> {firmadoPorDocumento || "-"}
        </p>
        <p>
          <strong>Cargo/relación:</strong> {firmadoPorCargo || "-"}
        </p>
        <div className="doc-sign-line" />
        <p>Firma cliente / representante</p>
      </section>
    </CorporateDocumentLayout>
  );
}
