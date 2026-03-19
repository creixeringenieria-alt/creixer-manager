import type { ReactNode } from "react";

interface CorporateDocumentLayoutProps {
  title: string;
  code: string;
  date: string;
  logoUrl?: string;
  letterheadUrl?: string;
  watermarkUrl?: string;
  watermarkText?: string;
  children: ReactNode;
  signatureName?: string;
  signatureRole?: string;
  signatureImageUrl?: string;
  clientSignatureName?: string;
  clientSignatureRole?: string;
  clientSignatureImageUrl?: string;
}

export default function CorporateDocumentLayout({
  title,
  code,
  date,
  logoUrl = "/logo-creixer.png",
  letterheadUrl = "/membrete-creixer.png",
  watermarkUrl,
  watermarkText = "CREIXER INGENIERIA",
  children,
  signatureName = "Julián Gamboa",
  signatureRole = "Dirección Técnica",
  signatureImageUrl,
  clientSignatureName = "Recibido por cliente",
  clientSignatureRole = "Nombre y cargo",
  clientSignatureImageUrl
}: CorporateDocumentLayoutProps) {
  return (
    <section className="doc-page-shell">
      <article className="doc-print-page">
        <img src={letterheadUrl} alt="Membrete Creixer" className="doc-letterhead-layer" />
        {watermarkUrl ? (
          <img src={watermarkUrl} alt="Marca de agua" className="watermark-image" />
        ) : (
          <div className="watermark">{watermarkText}</div>
        )}

        <div className="doc-print-content">
          <header className="doc-header">
            <div className="doc-brand">
              <img src={logoUrl || "/logo-creixer.png"} alt="Creixer Ingeniería" className="doc-logo" />
              <div>
                <h2>Creixer Ingeniería</h2>
                <p>Servicios técnicos, mantenimiento, consultoría e interventoría</p>
              </div>
            </div>
            <div className="doc-meta">
              <p>
                <strong>Documento:</strong> {title}
              </p>
              <p>
                <strong>Código:</strong> {code}
              </p>
              <p>
                <strong>Fecha:</strong> {date}
              </p>
            </div>
          </header>

          <div className="doc-body">{children}</div>

          <footer className="doc-footer">
            <div className="doc-signature">
              <p>Firma responsable Creixer</p>
              {signatureImageUrl ? <img src={signatureImageUrl} alt="Firma responsable Creixer" className="doc-sign-image" /> : null}
              <div className="doc-sign-line" />
              <p>
                <strong>{signatureName}</strong>
              </p>
              <p>{signatureRole}</p>
            </div>
            <div className="doc-signature">
              <p>Firma cliente / recibido</p>
              {clientSignatureImageUrl ? (
                <img src={clientSignatureImageUrl} alt="Firma cliente" className="doc-sign-image" />
              ) : null}
              <div className="doc-sign-line" />
              <p>
                <strong>{clientSignatureName}</strong>
              </p>
              <p>{clientSignatureRole}</p>
            </div>
            <div className="doc-foot-note">
              <p>Creixer Ingeniería S.A.S.</p>
              <p>Documento corporativo emitido por Creixer Manager</p>
            </div>
          </footer>
        </div>
      </article>
    </section>
  );
}
