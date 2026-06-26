import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import { adjuntarDocumentosCasoAction, editarCasoAction, eliminarCasoAction, eliminarDocumentoCasoAction } from "./actions";

interface EditarCasoPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}

type ClientRow = {
  id: string;
  name: string;
  client_type?: string | null;
  tax_id?: string | null;
  documentary_prefix?: string | null;
};

type InternalUserRow = {
  id: string;
  full_name?: string | null;
  role?: string | null;
};

type CaseData = {
  id: string;
  case_code?: string | null;
  client_id?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  flow_type?: string | null;
  service_area?: string | null;
  current_stage?: string | null;
  internal_client_code?: string | null;
  external_property_code?: string | null;
  external_case_id?: string | null;
  external_case_code?: string | null;
  assigned_to_user_id?: string | null;
  bill_to_assigned_client?: boolean | null;
  billing_client_id?: string | null;
  billing_observations?: string | null;
};

type CaseDocumentRow = {
  id: string;
  document_type?: string | null;
  name?: string | null;
  original_filename?: string | null;
  created_at?: string | null;
};

function dateTimeValue(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("es-CO") : "-";
}

function documentTypeLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    factura: "Factura",
    informe_final: "Informe final",
    informe_visita: "Informe de visita",
    cotizacion: "Cotización",
    acta_satisfaccion: "Acta de satisfacción",
    otro: "Otros"
  };
  return value ? labels[value] ?? value : "-";
}

function caseDisplayReference(caseData: CaseData) {
  return [caseData.internal_client_code, caseData.external_property_code, caseData.case_code].filter(Boolean).join(" | ");
}

const CASE_DOCUMENT_SLOTS = [
  {
    type: "factura",
    title: "Factura",
    description: "Documento de facturación del servicio.",
    folder: "Facturación",
    multiple: false,
    button: "Cargar factura"
  },
  {
    type: "informe_final",
    title: "Informe final",
    description: "Informe final del trabajo realizado.",
    folder: "Informes",
    multiple: false,
    button: "Cargar informe final"
  },
  {
    type: "informe_visita",
    title: "Informe de visita",
    description: "Informe técnico inicial o soporte de visita.",
    folder: "Informes",
    multiple: false,
    button: "Cargar informe de visita"
  },
  {
    type: "cotizacion",
    title: "Cotización",
    description: "Cotización enviada o aprobada para el caso.",
    folder: "Facturación",
    multiple: false,
    button: "Cargar cotización"
  },
  {
    type: "acta_satisfaccion",
    title: "Acta de satisfacción",
    description: "Acta firmada o soporte de satisfacción.",
    folder: "Satisfacción",
    multiple: false,
    button: "Cargar acta"
  },
  {
    type: "otro",
    title: "Otros",
    description: "Hasta 3 archivos adicionales del caso.",
    folder: "Otros",
    multiple: true,
    button: "Cargar otros"
  }
];

export default async function EditarCasoPage({ params, searchParams }: EditarCasoPageProps) {
  await requirePagePermission("editar_casos", "/dashboard/casos", "Acceso denegado para editar casos.");

  const { id } = await params;
  const query = await searchParams;
  const supabase = createAdminClient() as any;

  const caseSelectBase =
    "id, case_code, client_id, title, description, status, priority, flow_type, service_area, current_stage, internal_client_code, external_property_code, external_case_id, external_case_code, bill_to_assigned_client, billing_client_id, billing_observations";
  let caseResp = await supabase
    .from("cases")
    .select(`${caseSelectBase}, assigned_to_user_id`)
    .eq("id", id)
    .maybeSingle();

  if (caseResp.error?.message?.includes("assigned_to_user_id")) {
    console.error("[/dashboard/casos/[id]/editar] assigned_to_user_id column unavailable, retrying without it", {
      id,
      error: caseResp.error.message
    });
    caseResp = await supabase.from("cases").select(caseSelectBase).eq("id", id).maybeSingle();
  }

  const [clientsResp, internalUsersResp, docsResp] = await Promise.all([
    supabase.from("clients").select("id, name, client_type, tax_id, documentary_prefix").eq("is_active", true).order("name"),
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("is_active", true)
      .eq("user_type", "colaborador_creixer")
      .order("full_name"),
    supabase
      .from("case_documents")
      .select("id, document_type, name, original_filename, created_at")
      .eq("case_id", id)
      .order("created_at", { ascending: false })
  ]);

  if (caseResp.error) {
    console.error("[/dashboard/casos/[id]/editar] case query failed", { id, error: caseResp.error.message });
  }
  if (clientsResp.error) {
    console.error("[/dashboard/casos/[id]/editar] clients query failed", { error: clientsResp.error.message });
  }
  if (internalUsersResp.error) {
    console.error("[/dashboard/casos/[id]/editar] internal users query failed", { error: internalUsersResp.error.message });
  }
  if (docsResp.error) {
    console.error("[/dashboard/casos/[id]/editar] documents query failed", { id, error: docsResp.error.message });
  }

  const caseData = caseResp.data as CaseData | null;
  const clients = ((clientsResp.data ?? []) as ClientRow[]) || [];
  const internalUsers = ((internalUsersResp.data ?? []) as InternalUserRow[]) || [];
  const docs = ((docsResp.data ?? []) as CaseDocumentRow[]) || [];
  const documentCounts = docs.reduce<Record<string, number>>((acc, doc) => {
    const key = doc.document_type ?? "otro";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const currentClient = clients.find((client) => client.id === caseData?.client_id);
  const assignedUser = internalUsers.find((user) => user.id === caseData?.assigned_to_user_id);
  const requiredDocumentSlots = CASE_DOCUMENT_SLOTS.filter((slot) => slot.type !== "otro");
  const requiredDocumentTypes = requiredDocumentSlots.map((slot) => slot.type);
  const additionalDocs = docs.filter((doc) => !requiredDocumentTypes.includes(doc.document_type ?? ""));
  const caseReference = caseData ? caseDisplayReference(caseData) || caseData.title || caseData.case_code || `Caso ${caseData.id.slice(0, 8)}` : "";
  const folderCounts = {
    Informes: docs.filter((doc) => doc.document_type === "informe_final" || doc.document_type === "informe_visita").length,
    Facturación: docs.filter((doc) => doc.document_type === "factura" || doc.document_type === "cotizacion").length,
    Satisfacción: docs.filter((doc) => doc.document_type === "acta_satisfaccion").length,
    Otros: additionalDocs.length
  };

  if (!caseData) {
    return (
      <main>
        <p className="feedback error">No se encontró el caso para editar.</p>
        {caseResp.error ? <p className="feedback error">{caseResp.error.message}</p> : null}
        <Link href="/dashboard/casos">Volver a casos</Link>
      </main>
    );
  }

  return (
    <main>
      <nav className="case-breadcrumb" aria-label="Ruta del caso">
        <Link href="/dashboard/casos">Casos</Link>
        <span>/</span>
        <Link href={`/dashboard/casos/${caseData.id}`}>{caseData.case_code ?? `Caso ${caseData.id.slice(0, 8)}`}</Link>
        <span>/</span>
        <span>{caseReference}</span>
        <span>/</span>
        <strong>Documentos y edición</strong>
      </nav>

      <div className="page-header">
        <div>
          <h1>Editar caso</h1>
          <p>
            Organiza la ruta documental, adjuntos y datos operativos de este caso.
          </p>
        </div>
        <div className="inline-form">
          <Link href={`/dashboard/casos/${caseData.id}`}>Volver a vista única</Link>
          <Link href="/dashboard/casos">Volver a casos</Link>
        </div>
      </div>

      {query.error ? <p className="feedback error">{query.error}</p> : null}
      {query.ok ? <p className="feedback success">{query.ok}</p> : null}
      {clientsResp.error ? <p className="feedback error">No fue posible cargar clientes: {clientsResp.error.message}</p> : null}
      {internalUsersResp.error ? (
        <p className="feedback error">No fue posible cargar responsables internos: {internalUsersResp.error.message}</p>
      ) : null}
      {docsResp.error ? <p className="feedback error">No fue posible cargar adjuntos: {docsResp.error.message}</p> : null}

      <div className="case-workspace">
        <aside className="case-sidebar">
          <Link href="/dashboard/casos" className="case-back-link">
            Volver a casos
          </Link>
          <div className="case-sidebar-heading">
            <span>{caseData.case_code ?? `Caso ${caseData.id.slice(0, 8)}`}</span>
            <strong className="case-status-pill">{caseData.status ?? "sin_estado"}</strong>
          </div>
          <h2>{caseReference}</h2>
          <p>{caseData.flow_type ?? "Sin tipo"}</p>
          <p>{currentClient?.name ?? "Cliente no encontrado"}</p>
          <p>Responsable: {assignedUser?.full_name ?? "Pendiente por asignar"}</p>

          <nav className="case-side-nav" aria-label="Secciones del caso">
            <a href="#datos-caso">Información general</a>
            <a href="#documentos-caso" className="active">
              Documentos
            </a>
            <a href={`/dashboard/casos/${caseData.id}`}>Resumen</a>
            <a href="#eliminar-caso">Eliminar</a>
          </nav>
        </aside>

        <div className="case-content">
      <section className="card">
        <div id="datos-caso" />
        <h2>Datos editables del caso</h2>
        <form action={editarCasoAction} className="form-grid">
          <input type="hidden" name="case_id" value={caseData.id} />

          <div className="form-field">
            <label htmlFor="case-client-id">Cliente / Tercero</label>
            <select id="case-client-id" name="client_id" required defaultValue={caseData.client_id ?? ""}>
              <option value="" disabled>
                Seleccionar cliente o tercero
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                  {client.client_type ? ` — ${client.client_type}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="case-flow-type">Tipo de proyecto</label>
            <select id="case-flow-type" name="flow_type" required defaultValue={caseData.flow_type ?? "mantenimiento"}>
              <option value="mantenimiento">mantenimiento</option>
              <option value="reparacion">reparacion</option>
              <option value="consultoria">consultoria</option>
              <option value="interventoria">interventoria</option>
              <option value="obra_conjunto_residencial">obra_conjunto_residencial</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="case-internal-client-code">Código interno / referencia del cliente</label>
            <input id="case-internal-client-code" name="internal_client_code" defaultValue={caseData.internal_client_code ?? ""} />
          </div>

          <div className="form-field">
            <label htmlFor="case-external-property-code">N° inmueble / identificación / referencia</label>
            <input id="case-external-property-code" name="external_property_code" defaultValue={caseData.external_property_code ?? ""} />
          </div>

          <div className="form-field">
            <label htmlFor="case-external-id">ID externo del caso</label>
            <input id="case-external-id" name="external_case_id" defaultValue={caseData.external_case_id ?? ""} />
          </div>

          <div className="form-field">
            <label htmlFor="case-external-code">Código externo del caso</label>
            <input id="case-external-code" name="external_case_code" defaultValue={caseData.external_case_code ?? ""} />
          </div>

          <div className="form-field">
            <label htmlFor="case-service-area">Caso / Requerimiento</label>
            <select id="case-service-area" name="service_area" required defaultValue={caseData.service_area ?? "mantenimiento_general"}>
              <option value="hidraulico">hidraulico</option>
              <option value="electrico">electrico</option>
              <option value="gasodomestico">gasodomestico</option>
              <option value="albanileria">albanileria</option>
              <option value="acabados">acabados</option>
              <option value="mantenimiento_general">mantenimiento_general</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="case-priority">Prioridad</label>
            <select id="case-priority" name="priority" defaultValue={caseData.priority ?? "media"}>
              <option value="baja">baja</option>
              <option value="media">media</option>
              <option value="alta">alta</option>
              <option value="critica">critica</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="case-assigned-to-user-id">Asignado a</label>
            <select id="case-assigned-to-user-id" name="assigned_to_user_id" defaultValue={caseData.assigned_to_user_id ?? ""}>
              <option value="">Pendiente por asignar</option>
              {internalUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name ?? "Usuario interno"}
                  {user.role ? ` — ${user.role}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="case-status">Estado del caso</label>
            <select id="case-status" name="status" required defaultValue={caseData.status ?? "creado"}>
              <option value="creado">creado</option>
              <option value="programado">programado</option>
              <option value="en_visita">en_visita</option>
              <option value="en_cotizacion">en_cotizacion</option>
              <option value="autorizada">autorizada</option>
              <option value="cerrado">cerrado</option>
              <option value="cancelado">cancelado</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="case-current-stage">Etapa operativa</label>
            <select id="case-current-stage" name="current_stage" required defaultValue={caseData.current_stage ?? "en_visita"}>
              <option value="en_visita">en_visita</option>
              <option value="visitado">visitado</option>
              <option value="pendiente_aprobacion">pendiente_aprobacion</option>
              <option value="aprobado">aprobado</option>
              <option value="en_reparacion">en_reparacion</option>
              <option value="finalizado">finalizado</option>
              <option value="cancelado">cancelado</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="case-bill-to-assigned">Facturación inicial</label>
            <select
              id="case-bill-to-assigned"
              name="bill_to_assigned_client"
              defaultValue={caseData.bill_to_assigned_client === false ? "no" : "si"}
            >
              <option value="si">Facturar al cliente/tercero asignado</option>
              <option value="no">Otro / por definir después de aprobación</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="case-billing-client-id">Cliente a facturar</label>
            <select id="case-billing-client-id" name="billing_client_id" defaultValue={caseData.billing_client_id ?? ""}>
              <option value="">Otro / por definir</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                  {client.client_type ? ` — ${client.client_type}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="case-billing-observations">Observación de facturación</label>
            <textarea id="case-billing-observations" name="billing_observations" defaultValue={caseData.billing_observations ?? ""} />
          </div>

          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="case-description">Descripción del caso</label>
            <textarea id="case-description" name="description" defaultValue={caseData.description ?? ""} />
          </div>

          <button type="submit">Guardar cambios del caso</button>
        </form>
      </section>

      <section className="card case-documents-panel" id="documentos-caso">
        <div className="document-toolbar">
          <div>
            <p className="section-eyebrow">Expediente documental</p>
            <h2>Documentos del caso</h2>
            <p>Gestiona, visualiza y descarga la documentación asociada a este caso/proyecto.</p>
          </div>
          <div className="document-actions">
            <button type="button" className="ghost-btn" disabled>
              Nueva carpeta
            </button>
            <a className="primary-action-link" href="#documentos-requeridos">
              Subir documento
            </a>
          </div>
        </div>

        <div className="document-path">
          <span>Casos</span>
          <span>/</span>
          <span>{caseData.case_code ?? `Caso ${caseData.id.slice(0, 8)}`}</span>
          <span>/</span>
          <strong>Documentos</strong>
        </div>

        <h3>Carpetas</h3>
        <div className="folder-grid">
          {Object.entries(folderCounts).map(([folder, count]) => (
            <div className="folder-card" key={folder}>
              <div className="folder-icon" aria-hidden="true">
                Carpeta
              </div>
              <div>
                <strong>{folder}</strong>
                <p>
                  {count} {count === 1 ? "documento" : "documentos"}
                </p>
              </div>
            </div>
          ))}
        </div>

        <h3 id="documentos-requeridos">Documentos requeridos</h3>
        <div className="table-wrapper">
          <table className="data-table document-table">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Archivo</th>
                <th>Fecha de carga</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {requiredDocumentSlots.map((slot) => {
                const doc = docs.find((item) => item.document_type === slot.type);
                const fileInputId = `case-required-file-${slot.type}`;

                return (
                  <tr key={slot.type}>
                    <td>
                      <strong>{slot.title}</strong>
                    </td>
                    <td>{slot.description}</td>
                    <td>
                      <span className={doc ? "doc-state doc-state-done" : "doc-state doc-state-pending"}>
                        {doc ? "Cargado" : "Pendiente"}
                      </span>
                    </td>
                    <td>
                      {doc ? (
                        <a href={`/api/case-documents/${doc.id}`} target="_blank" rel="noreferrer">
                          {doc.original_filename ?? "Ver / descargar"}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>{doc ? dateTimeValue(doc.created_at) : "-"}</td>
                    <td>
                      {doc ? (
                        <form action={eliminarDocumentoCasoAction} className="compact-action-form">
                          <input type="hidden" name="case_id" value={caseData.id} />
                          <input type="hidden" name="document_id" value={doc.id} />
                          <button type="submit" className="danger-btn">
                            Eliminar
                          </button>
                        </form>
                      ) : (
                        <form action={adjuntarDocumentosCasoAction} className="compact-upload-form">
                          <input type="hidden" name="case_id" value={caseData.id} />
                          <input type="hidden" name="case_document_type" value={slot.type} />
                          <input type="hidden" name="case_document_name" value={slot.title} />
                          <label className="compact-file-label" htmlFor={fileInputId}>
                            Seleccionar archivo
                          </label>
                          <input
                            id={fileInputId}
                            name="case_files"
                            type="file"
                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                            required
                          />
                          <button type="submit">Subir</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="document-section-header">
          <div>
            <h3>Otros documentos</h3>
            <p>Documentos adicionales que no estén en los requeridos. Puedes cargar hasta 3 archivos como “Otros”.</p>
          </div>
          <strong>{documentCounts.otro ?? 0}/3 usados</strong>
        </div>

        <form action={adjuntarDocumentosCasoAction} className="other-upload-form">
          <input type="hidden" name="case_id" value={caseData.id} />
          <input type="hidden" name="case_document_type" value="otro" />
          <div className="form-field">
            <label htmlFor="case-other-document-name">Nombre visible del soporte</label>
            <input
              id="case-other-document-name"
              name="case_document_name"
              placeholder="Ej: registro fotográfico, soporte del cliente, anexo técnico"
              disabled={(documentCounts.otro ?? 0) >= 3}
            />
          </div>
          <div className="form-field">
            <label htmlFor="case-other-files">Archivos adicionales</label>
            <input
              id="case-other-files"
              name="case_files"
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
              disabled={(documentCounts.otro ?? 0) >= 3}
            />
          </div>
          {(documentCounts.otro ?? 0) >= 3 ? (
            <p className="feedback error">Ya se cargaron los 3 documentos adicionales permitidos.</p>
          ) : (
            <button type="submit">Subir otro documento</button>
          )}
        </form>

        {additionalDocs.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table document-table">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Tipo</th>
                  <th>Archivo</th>
                  <th>Fecha de carga</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {additionalDocs.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.name ?? doc.original_filename ?? "Documento adicional"}</td>
                    <td>{documentTypeLabel(doc.document_type)}</td>
                    <td>
                      <a href={`/api/case-documents/${doc.id}`} target="_blank" rel="noreferrer">
                        {doc.original_filename ?? "Ver / descargar"}
                      </a>
                    </td>
                    <td>{dateTimeValue(doc.created_at)}</td>
                    <td>
                      <form action={eliminarDocumentoCasoAction} className="compact-action-form">
                        <input type="hidden" name="case_id" value={caseData.id} />
                        <input type="hidden" name="document_id" value={doc.id} />
                        <button type="submit" className="danger-btn">
                          Eliminar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No hay otros documentos registrados.</p>
        )}

        <p className="document-footnote">Formatos permitidos: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX, CSV y TXT. Tamaño máximo: 20 MB por archivo.</p>
      </section>

      <section className="card" id="eliminar-caso" style={{ borderColor: "#fecaca" }}>
        <h2>Eliminar caso</h2>
        <p className="feedback error" style={{ marginBottom: "1rem" }}>
          Esta acción elimina el caso operativo. Úsala solo si el caso fue creado por error.
        </p>
        <form action={eliminarCasoAction} className="form-grid">
          <input type="hidden" name="case_id" value={caseData.id} />
          <button type="submit" style={{ background: "#991b1b", borderColor: "#991b1b" }}>
            Eliminar caso
          </button>
        </form>
      </section>
        </div>
      </div>
    </main>
  );
}
