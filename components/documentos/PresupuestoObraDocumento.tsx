import CorporateDocumentLayout from "@/components/documentos/CorporateDocumentLayout";
import { Fragment } from "react";

interface BudgetRow {
  capitulo: string;
  actividad: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  total: number;
  origen: "apu" | "manual";
}

interface PresupuestoObraDocumentoProps {
  codigo: string;
  fecha: string;
  proyecto: string;
  cliente: string;
  rows: BudgetRow[];
}

function money(value: number) {
  return value.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  });
}

export default function PresupuestoObraDocumento({ codigo, fecha, proyecto, cliente, rows }: PresupuestoObraDocumentoProps) {
  const grouped = rows.reduce<Record<string, BudgetRow[]>>((acc, row) => {
    const key = row.capitulo || "Sin capítulo";
    acc[key] = [...(acc[key] ?? []), row];
    return acc;
  }, {});

  const chapterTotals = Object.fromEntries(
    Object.entries(grouped).map(([chapter, chapterRows]) => [
      chapter,
      chapterRows.reduce((sum, row) => sum + Number(row.total), 0)
    ])
  );

  const grandTotal = rows.reduce((sum, row) => sum + Number(row.total), 0);

  return (
    <CorporateDocumentLayout
      title="Presupuesto de obra por capítulos"
      code={codigo}
      date={fecha}
      watermarkText="PRESUPUESTO DE OBRA"
      signatureName="Julián Gamboa"
      signatureRole="Dirección Técnica"
      clientSignatureName="Aprobación cliente"
      clientSignatureRole="Nombre, cargo y firma"
    >
      <section className="doc-section">
        <h3>Datos generales</h3>
        <p>
          <strong>Proyecto:</strong> {proyecto}
        </p>
        <p>
          <strong>Cliente:</strong> {cliente}
        </p>
      </section>

      <section className="doc-section">
        <h3>Resumen por capítulos</h3>
        <div className="table-wrapper">
          <table className="data-table doc-table">
            <thead>
              <tr>
                <th>Capítulo</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(chapterTotals).map(([chapter, subtotal]) => (
                <tr key={`chapter-summary-${chapter}`}>
                  <td>{chapter}</td>
                  <td>{money(Number(subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="doc-section">
        <h3>Detalle de actividades presupuestadas</h3>
        <div className="table-wrapper">
          <table className="data-table doc-table">
            <thead>
              <tr>
                <th>Capítulo</th>
                <th>Actividad</th>
                <th>Origen</th>
                <th>Cantidad</th>
                <th>Unidad</th>
                <th>Precio unitario</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([chapter, chapterRows]) => (
                <Fragment key={`chapter-block-${chapter}`}>
                  <tr key={`chapter-title-${chapter}`}>
                    <td colSpan={7}>
                      <strong>{chapter}</strong> | Subtotal capítulo: {money(Number(chapterTotals[chapter] ?? 0))}
                    </td>
                  </tr>
                  {chapterRows.map((row, index) => (
                    <tr key={`chapter-row-${chapter}-${index}`}>
                      <td>{row.capitulo}</td>
                      <td>{row.actividad}</td>
                      <td>{row.origen}</td>
                      <td>{Number(row.cantidad)}</td>
                      <td>{row.unidad}</td>
                      <td>{money(Number(row.precioUnitario))}</td>
                      <td>{money(Number(row.total))}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="doc-section">
        <h3>Total general</h3>
        <div className="doc-totals">
          <p>
            <strong>Total presupuesto: {money(grandTotal)}</strong>
          </p>
        </div>
      </section>
    </CorporateDocumentLayout>
  );
}
