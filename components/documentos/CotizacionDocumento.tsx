import CorporateDocumentLayout from "@/components/documentos/CorporateDocumentLayout";

interface CotizacionItem {
  item_numero: number;
  descripcion: string;
  cantidad: number;
  unidad: string | null;
  valor_unitario: number;
  valor_total: number;
}

interface CotizacionFoto {
  url: string;
  caption: string | null;
}

interface CotizacionDocumentoProps {
  codigo: string;
  fecha: string;
  cliente: string;
  inmueble: string;
  direccion: string;
  contacto: string;
  requerimiento: string;
  logoUrl?: string;
  watermarkUrl?: string;
  watermarkText?: string;
  secciones: Record<string, string>;
  items: CotizacionItem[];
  subtotal: number;
  valorAdministracion: number;
  valorImprevisto: number;
  valorUtilidad: number;
  valorIva: number;
  total: number;
  fotos: CotizacionFoto[];
}

function money(value: number) {
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export default function CotizacionDocumento(props: CotizacionDocumentoProps) {
  return (
    <CorporateDocumentLayout
      title="Cotización técnica y comercial"
      code={props.codigo}
      date={props.fecha}
      logoUrl={props.logoUrl}
      watermarkUrl={props.watermarkUrl}
      watermarkText={props.watermarkText}
      signatureName={props.secciones.firma_final || "Julián Gamboa"}
      signatureRole="Dirección Técnica"
    >
      <section className="doc-section">
        <h3>Datos generales</h3>
        <p>
          <strong>Cliente:</strong> {props.cliente}
        </p>
        <p>
          <strong>Inmueble:</strong> {props.inmueble}
        </p>
        <p>
          <strong>Dirección:</strong> {props.direccion || "-"}
        </p>
        <p>
          <strong>Contacto:</strong> {props.contacto || "-"}
        </p>
        <p>
          <strong>ID servicio:</strong> {props.requerimiento || "-"}
        </p>
      </section>

      <section className="doc-section">
        <h3>Introducción</h3>
        <p>{props.secciones.introduccion || "-"}</p>
      </section>

      <section className="doc-section">
        <h3>Objetivo general</h3>
        <p>{props.secciones.objetivo_general || "-"}</p>
        {props.secciones.objetivos_especificos ? (
          <>
            <h4>Objetivos específicos</h4>
            <p>{props.secciones.objetivos_especificos}</p>
          </>
        ) : null}
      </section>

      <section className="doc-section">
        <h3>Diagnóstico preliminar</h3>
        <p>{props.secciones.diagnostico_preliminar || "-"}</p>
      </section>

      <section className="doc-section">
        <h3>Alcance de los trabajos</h3>
        <p>{props.secciones.alcance || "-"}</p>
      </section>

      <section className="doc-section">
        <h3>Presupuesto estimado</h3>
        <div className="table-wrapper">
          <table className="data-table doc-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Descripción</th>
                <th>Cant.</th>
                <th>Und.</th>
                <th>Vr Unitario</th>
                <th>Vr Total</th>
              </tr>
            </thead>
            <tbody>
              {props.items.map((item) => (
                <tr key={`doc-item-${item.item_numero}`}>
                  <td>{item.item_numero}</td>
                  <td>{item.descripcion}</td>
                  <td>{Number(item.cantidad)}</td>
                  <td>{item.unidad ?? "-"}</td>
                  <td>{money(Number(item.valor_unitario))}</td>
                  <td>{money(Number(item.valor_total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="doc-totals">
          <p>Subtotal: {money(props.subtotal)}</p>
          <p>Administración: {money(props.valorAdministracion)}</p>
          <p>Imprevisto: {money(props.valorImprevisto)}</p>
          <p>Utilidad: {money(props.valorUtilidad)}</p>
          <p>IVA: {money(props.valorIva)}</p>
          <p>
            <strong>Total: {money(props.total)}</strong>
          </p>
        </div>
      </section>

      <section className="doc-section">
        <h3>Condiciones</h3>
        <p>
          <strong>Nota importante:</strong> {props.secciones.notas_importantes || "-"}
        </p>
        <p>
          <strong>Plazo de ejecución:</strong> {props.secciones.tiempo_ejecucion || "-"}
        </p>
        <p>
          <strong>Garantía:</strong> {props.secciones.garantia || "-"}
        </p>
        <p>
          <strong>Forma de pago:</strong> {props.secciones.forma_pago || "-"}
        </p>
      </section>

      <section className="doc-section">
        <h3>Registro fotográfico</h3>
        {props.fotos.length === 0 ? (
          <p>No se incluyeron fotos.</p>
        ) : (
          <div className="doc-photo-grid">
            {props.fotos.map((foto, index) => (
              <figure key={`doc-foto-${index}`} className="doc-photo-card">
                <img src={foto.url} alt={foto.caption ?? `Foto ${index + 1}`} />
                <figcaption>{foto.caption || `Foto ${index + 1}`}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </CorporateDocumentLayout>
  );
}
