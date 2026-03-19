interface FotoIncluida {
  storage_path: string;
  descripcion: string;
  orden: number;
}

interface CotizacionPreviewProps {
  empresaNombre: string;
  logoUrl: string;
  marcaAguaTexto: string;
  marcaAguaUrl: string;
  codigoCotizacion: string;
  fechaCotizacion: string;
  clienteLabel: string;
  inmuebleLabel: string;
  requerimientoLabel: string;
  direccion: string;
  secciones: Record<string, string>;
  subtotal: number;
  valorAdministracion: number;
  valorImprevisto: number;
  valorUtilidad: number;
  valorIva: number;
  totalFinal: number;
  fotos: FotoIncluida[];
}

export default function CotizacionPreview({
  empresaNombre,
  logoUrl,
  marcaAguaTexto,
  marcaAguaUrl,
  codigoCotizacion,
  fechaCotizacion,
  clienteLabel,
  inmuebleLabel,
  requerimientoLabel,
  direccion,
  secciones,
  subtotal,
  valorAdministracion,
  valorImprevisto,
  valorUtilidad,
  valorIva,
  totalFinal,
  fotos
}: CotizacionPreviewProps) {
  return (
    <section className="card printable-sheet cotizacion-preview-operativa">
      {marcaAguaUrl ? (
        <img src={marcaAguaUrl} alt="Marca de agua" className="watermark-image" />
      ) : (
        <div className="watermark">{marcaAguaTexto || "CREIXER MANAGER"}</div>
      )}

      <header className="cot-header">
        <div>
          <h2>{empresaNombre || "Creixer Manager"}</h2>
          <p>
            <strong>ID servicio:</strong> {requerimientoLabel || "-"}
          </p>
          <p>
            <strong>Cliente:</strong> {clienteLabel || "-"}
          </p>
          <p>
            <strong>Inmueble:</strong> {inmuebleLabel || "-"}
          </p>
          <p>
            <strong>Dirección:</strong> {direccion || "-"}
          </p>
        </div>
        <div>
          {logoUrl ? <img src={logoUrl} alt="Logo" className="logo-preview" /> : null}
          <p>
            <strong>Cotización:</strong> {codigoCotizacion || "Sin código"}
          </p>
          <p>
            <strong>Fecha:</strong> {fechaCotizacion || "-"}
          </p>
        </div>
      </header>

      <h3>Introducción</h3>
      <p>{secciones.introduccion || "-"}</p>

      <h3>Objetivo general</h3>
      <p>{secciones.objetivo_general || "-"}</p>

      <h3>Objetivos específicos</h3>
      <p>{secciones.objetivos_especificos || "-"}</p>

      <h3>Diagnóstico preliminar</h3>
      <p>{secciones.diagnostico_preliminar || "-"}</p>

      <h3>Alcance de los trabajos</h3>
      <p>{secciones.alcance || "-"}</p>

      <h3>Resumen económico</h3>
      <p>Subtotal: {subtotal.toLocaleString("es-CO", { maximumFractionDigits: 2 })}</p>
      <p>Administración: {valorAdministracion.toLocaleString("es-CO", { maximumFractionDigits: 2 })}</p>
      <p>Imprevisto: {valorImprevisto.toLocaleString("es-CO", { maximumFractionDigits: 2 })}</p>
      <p>Utilidad: {valorUtilidad.toLocaleString("es-CO", { maximumFractionDigits: 2 })}</p>
      <p>IVA: {valorIva.toLocaleString("es-CO", { maximumFractionDigits: 2 })}</p>
      <p>
        <strong>Total: {totalFinal.toLocaleString("es-CO", { maximumFractionDigits: 2 })}</strong>
      </p>

      <h3>Nota importante</h3>
      <p>{secciones.notas_importantes || "-"}</p>

      <h3>Plazo de ejecución</h3>
      <p>{secciones.tiempo_ejecucion || "-"}</p>

      <h3>Garantía</h3>
      <p>{secciones.garantia || "-"}</p>

      <h3>Forma de pago</h3>
      <p>{secciones.forma_pago || "-"}</p>

      <h3>Registro fotográfico</h3>
      {fotos.length === 0 ? (
        <p>No hay fotos seleccionadas.</p>
      ) : (
        <ul>
          {fotos
            .slice()
            .sort((a, b) => a.orden - b.orden)
            .map((foto, index) => (
              <li key={`preview-foto-${index}`}>
                #{foto.orden} - {foto.storage_path} {foto.descripcion ? `(${foto.descripcion})` : ""}
              </li>
            ))}
        </ul>
      )}

      <h3>Firma final</h3>
      <p>{secciones.firma_final || "-"}</p>
    </section>
  );
}
