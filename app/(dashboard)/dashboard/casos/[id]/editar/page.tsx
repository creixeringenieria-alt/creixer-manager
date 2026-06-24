import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import { adjuntarDocumentosCasoAction, editarCasoAction, eliminarCasoAction } from "./actions";

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

  const [clientsResp, internalUsersResp] = await Promise.all([
    supabase.from("clients").select("id, name, client_type, tax_id, documentary_prefix").eq("is_active", true).order("name"),
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("is_active", true)
      .eq("user_type", "colaborador_creixer")
      .order("full_name")
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

  const caseData = caseResp.data as CaseData | null;
  const clients = ((clientsResp.data ?? []) as ClientRow[]) || [];
  const internalUsers = ((internalUsersResp.data ?? []) as InternalUserRow[]) || [];

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
      <div className="page-header">
        <div>
          <h1>Editar caso</h1>
          <p>
            {caseData.case_code ?? `Caso ${caseData.id.slice(0, 8)}`} | Puedes ajustar todos los datos operativos del caso.
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

      <section className="card">
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

      <section className="card">
        <h2>Adjuntar documentos o fotos</h2>
        <p>Sube evidencias, fotos, documentos del cliente o soportes técnicos asociados a este caso.</p>
        <form action={adjuntarDocumentosCasoAction} className="form-grid">
          <input type="hidden" name="case_id" value={caseData.id} />

          <div className="form-field">
            <label htmlFor="case-document-type">Tipo de soporte</label>
            <select id="case-document-type" name="case_document_type" defaultValue="evidencia_fotografica">
              <option value="evidencia_fotografica">Evidencia fotográfica</option>
              <option value="documento_cliente">Documento del cliente</option>
              <option value="soporte_tecnico">Soporte técnico</option>
              <option value="plano">Plano</option>
              <option value="cotizacion_recibida">Cotización recibida</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="case-document-name">Nombre visible del soporte (opcional)</label>
            <input id="case-document-name" name="case_document_name" placeholder="Ej: Fotos visita inicial" />
          </div>

          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="case-files">Archivos o fotos</label>
            <input
              id="case-files"
              name="case_files"
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
            />
          </div>

          <button type="submit">Adjuntar soportes</button>
        </form>
      </section>

      <section className="card" style={{ borderColor: "#fecaca" }}>
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
    </main>
  );
}
